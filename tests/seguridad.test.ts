import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, cerrarPool } from './helpers.js';
import { config } from '../src/config/env.js';

after(cerrarPool);

// Ruta inexistente: los headers los ponen helmet y cors antes de llegar a las rutas, sin tocar la BD
const RUTA = '/ruta-inexistente';

describe('Headers de seguridad (helmet)', () => {
    it('no expone x-powered-by y manda nosniff', async () => {
        const res = await api.get(RUTA);
        assert.equal(res.headers['x-powered-by'], undefined);
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });
});

describe('Ruta inexistente', () => {
    it('da 404 con code RUTA_NO_ENCONTRADA', async () => {
        const res = await api.get(RUTA);
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'RUTA_NO_ENCONTRADA');
    });
});

describe('X-Request-Id', () => {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    // 200 (pública), 401 (sin token) y 404: el id se pone antes que las rutas y la autenticación
    const casos: [string, number][] = [
        ['/libros', 200],
        ['/prestamos', 401],
        [RUTA, 404],
    ];
    for (const [ruta, status] of casos) {
        it(`GET ${ruta} (${status}) trae x-request-id`, async () => {
            const res = await api.get(ruta);
            assert.equal(res.status, status);
            assert.match(String(res.headers['x-request-id']), UUID);
        });
    }

    it('reutiliza un X-Request-Id válido', async () => {
        const res = await api.get(RUTA).set('X-Request-Id', 'abc-123');
        assert.equal(res.headers['x-request-id'], 'abc-123');
    });

    const invalidos: [string, string][] = [
        ['muy largo', 'a'.repeat(65)],
        ['con espacios', 'hola mundo'],
    ];
    for (const [caso, valor] of invalidos) {
        it(`reemplaza un X-Request-Id inválido (${caso}) por uno nuevo`, async () => {
            const res = await api.get(RUTA).set('X-Request-Id', valor);
            assert.match(String(res.headers['x-request-id']), UUID);
        });
    }
});

describe('CORS', () => {
    const [permitido] = config.corsOrigins;

    it('un Origin permitido recibe access-control-allow-origin', async () => {
        assert.ok(permitido, 'define CORS_ORIGINS en .env.test');
        const res = await api.get(RUTA).set('Origin', permitido);
        assert.equal(res.headers['access-control-allow-origin'], permitido);
    });

    it('un Origin no permitido no lo recibe', async () => {
        const res = await api.get(RUTA).set('Origin', 'http://malicioso.com');
        assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
});
