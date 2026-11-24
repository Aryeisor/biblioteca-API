import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from 'redis';
import { PREFIJO_CLAVES, type AlmacenLimites } from '../src/limites/almacen.js';
import { crearAlmacenMemoria } from '../src/limites/almacenMemoria.js';
import { crearAlmacenRedis } from '../src/limites/almacenRedis.js';
import { usarAlmacenLimites } from '../src/middlewares/rateLimit.js';
import { api, cerrarPool } from './helpers.js';

after(cerrarPool);

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clave = (nombre: string) => `${PREFIJO_CLAVES}test:${nombre}`;

// El mismo contrato para los dos almacenes: si uno se comporta distinto, estos tests lo delatan.
const contrato = (obtener: () => AlmacenLimites) => {
    beforeEach(() => obtener().reiniciar());

    it('cuenta cada petición de la misma clave', async () => {
        const almacen = obtener();
        assert.equal((await almacen.incrementar(clave('a'), 5_000)).cuenta, 1);
        assert.equal((await almacen.incrementar(clave('a'), 5_000)).cuenta, 2);
        assert.equal((await almacen.incrementar(clave('a'), 5_000)).cuenta, 3);
    });

    it('las claves distintas no se afectan', async () => {
        const almacen = obtener();
        await almacen.incrementar(clave('a'), 5_000);
        await almacen.incrementar(clave('a'), 5_000);
        assert.equal((await almacen.incrementar(clave('b'), 5_000)).cuenta, 1);
    });

    it('informa cuánto falta para que termine la ventana', async () => {
        const { msRestantes } = await obtener().incrementar(clave('a'), 5_000);
        assert.ok(
            msRestantes > 0 && msRestantes <= 5_000,
            `msRestantes fuera de rango: ${msRestantes}`,
        );
    });

    it('la ventana se reinicia al vencer', async () => {
        const almacen = obtener();
        await almacen.incrementar(clave('a'), 100);
        await almacen.incrementar(clave('a'), 100);
        await dormir(180);
        assert.equal((await almacen.incrementar(clave('a'), 100)).cuenta, 1);
    });

    it('reiniciar borra los contadores', async () => {
        const almacen = obtener();
        await almacen.incrementar(clave('a'), 5_000);
        await almacen.reiniciar();
        assert.equal((await almacen.incrementar(clave('a'), 5_000)).cuenta, 1);
    });

    it('50 peticiones simultáneas no pierden ni repiten ningún conteo', async () => {
        const almacen = obtener();
        const resultados = await Promise.all(
            Array.from({ length: 50 }, () => almacen.incrementar(clave('a'), 5_000)),
        );
        const cuentas = resultados.map((r) => r.cuenta).sort((a, b) => a - b);
        assert.deepEqual(
            cuentas,
            Array.from({ length: 50 }, (_, i) => i + 1),
        );
    });
};

describe('Almacén de límites en memoria', () => {
    const almacen = crearAlmacenMemoria();
    contrato(() => almacen);
});

const REDIS_URL = process.env.REDIS_URL;

describe(
    'Almacén de límites en Redis',
    { skip: REDIS_URL ? false : 'REDIS_URL no está definida' },
    () => {
        const cliente = createClient({ url: REDIS_URL });
        cliente.on('error', () => undefined); // los fallos de conexión se ven en los tests mismos
        const almacen = crearAlmacenRedis(cliente);

        before(() => cliente.connect());
        after(() => cliente.close());

        contrato(() => almacen);

        it('toda clave nueva queda con expiración (no puede quedar un contador eterno)', async () => {
            await almacen.incrementar(clave('ttl'), 5_000);
            const ttl = await cliente.pTTL(clave('ttl'));
            assert.ok(ttl > 0 && ttl <= 5_000, `PTTL inesperado: ${ttl}`);
        });

        it('repara una clave que existía sin expiración', async () => {
            await cliente.set(clave('huerfana'), '5'); // SET sin EX: como si el proceso hubiera muerto a medias
            const { cuenta } = await almacen.incrementar(clave('huerfana'), 5_000);
            assert.equal(cuenta, 6);
            const ttl = await cliente.pTTL(clave('huerfana'));
            assert.ok(ttl > 0 && ttl <= 5_000, `PTTL inesperado: ${ttl}`);
        });
    },
);

describe('Rate limiting cuando el almacén falla', () => {
    let anterior: AlmacenLimites;
    after(() => usarAlmacenLimites(anterior));

    const intentos = async (): Promise<number[]> => {
        const estados: number[] = [];
        // el límite por email es 5: con 7 intentos, un limitador sano daría 429 al 6.º
        for (let i = 0; i < 7; i++) {
            const res = await api
                .post('/auth/login')
                .send({ email: 'nadie@correo.com', password: 'clave12345' });
            estados.push(res.status);
        }
        return estados;
    };

    it('deja pasar las peticiones si el almacén devuelve error (fail open)', async () => {
        anterior = usarAlmacenLimites({
            incrementar: () => Promise.reject(new Error('Redis caído')),
            reiniciar: () => Promise.resolve(),
        });
        assert.deepEqual(await intentos(), [401, 401, 401, 401, 401, 401, 401]);
    });

    it('deja pasar las peticiones si el almacén no responde a tiempo', async () => {
        usarAlmacenLimites({
            incrementar: () => new Promise(() => undefined), // nunca resuelve
            reiniciar: () => Promise.resolve(),
        });
        const inicio = Date.now();
        const res = await api
            .post('/auth/login')
            .send({ email: 'nadie@correo.com', password: 'clave12345' });
        assert.equal(res.status, 401);
        assert.ok(Date.now() - inicio < 3_000, 'la petición no debería esperar más del tope');
    });
});
