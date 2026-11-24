import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PoolClient } from 'pg';
import pool from '../src/config/db.js';
import {
    aplicarMigraciones,
    marcarComoAplicadas,
    estadoMigraciones,
    DIRECTORIO_MIGRACIONES,
} from '../src/migraciones/ejecutor.js';
import { cerrarPool } from './helpers.js'; // también trae la protección: DB_NAME debe terminar en _test

after(cerrarPool);

// Cada test trabaja en un schema propio de PostgreSQL: el ejecutor usa nombres sin calificar
// (usuarios, schema_migrations...), así que con search_path van a parar ahí y no tocan las tablas
// de los demás tests.
const SCHEMA = 'migraciones_test';

describe('Migraciones', () => {
    let client: PoolClient;
    let carpeta: string;

    before(async () => {
        client = await pool.connect();
    });
    after(() => client.release());

    beforeEach(async () => {
        await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
        await client.query(`CREATE SCHEMA ${SCHEMA}`);
        await client.query(`SET search_path TO ${SCHEMA}`);
        carpeta = await mkdtemp(path.join(tmpdir(), 'migraciones-'));
    });

    afterEach(async () => {
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
        await rm(carpeta, { recursive: true, force: true });
    });

    const existe = async (objeto: string): Promise<boolean> => {
        const { rows } = await client.query<{ existe: string | null }>(
            'SELECT to_regclass($1) AS existe',
            [objeto],
        );
        return rows[0]?.existe != null;
    };

    const versionesRegistradas = async (): Promise<string[]> =>
        (
            await client.query<{ version: string }>(
                'SELECT version FROM schema_migrations ORDER BY version',
            )
        ).rows.map((r) => r.version);

    it('construye una base vacía solo con migraciones y las registra en orden', async () => {
        const aplicadas = await aplicarMigraciones(client);

        assert.deepEqual(aplicadas, ['000', '001', '002', '003']);
        assert.deepEqual(await versionesRegistradas(), ['000', '001', '002', '003']);
        for (const tabla of ['autores', 'libros', 'usuarios', 'prestamos']) {
            assert.equal(await existe(tabla), true, `falta la tabla ${tabla}`);
        }
        // lo que dejan 001, 002 y 003
        const { rows } = await client.query(
            "SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'usuarios' AND column_name = 'rol'",
            [SCHEMA],
        );
        assert.equal(rows.length, 1);
        assert.equal(await existe('uq_prestamo_activo'), true);
        assert.equal(await existe('idx_prestamos_usuario_id_id'), true);
        assert.equal(await existe('idx_prestamos_usuario_id'), false); // la 002 lo borra
    });

    it('una segunda ejecución no aplica nada', async () => {
        await aplicarMigraciones(client);
        assert.deepEqual(await aplicarMigraciones(client), []);
        assert.equal((await versionesRegistradas()).length, 4);
    });

    it('rechaza una migración modificada después de aplicarse', async () => {
        await cp(DIRECTORIO_MIGRACIONES, carpeta, { recursive: true });
        await aplicarMigraciones(client, carpeta);

        const archivo = path.join(carpeta, '001_agregar_rol_usuarios.sql');
        await writeFile(archivo, '-- alguien la editó\nSELECT 1;\n');

        await assert.rejects(() => aplicarMigraciones(client, carpeta), /fue modificada/);
    });

    it('la huella no cambia por los saltos de línea (CRLF vs LF)', async () => {
        await cp(DIRECTORIO_MIGRACIONES, carpeta, { recursive: true });
        await aplicarMigraciones(client, carpeta);

        const archivo = path.join(carpeta, '000_esquema_inicial.sql');
        const original = await readFile(archivo, 'utf8');
        const convertido = original.includes('\r\n')
            ? original.replace(/\r\n/g, '\n')
            : original.replace(/\n/g, '\r\n');
        await writeFile(archivo, convertido);

        assert.deepEqual(await aplicarMigraciones(client, carpeta), []);
    });

    it('si una migración falla se deshace entera y no queda registrada', async () => {
        await writeFile(path.join(carpeta, '000_ok.sql'), 'CREATE TABLE prueba_a (id INT);');
        await writeFile(
            path.join(carpeta, '001_rota.sql'),
            'CREATE TABLE prueba_b (id INT); SELECT * FROM tabla_que_no_existe;',
        );

        await assert.rejects(
            () => aplicarMigraciones(client, carpeta),
            /Falló la migración 001_rota/,
        );

        assert.equal(await existe('prueba_a'), true); // la 000 sí se aplicó y se conserva
        assert.equal(await existe('prueba_b'), false); // la 001 se revirtió completa
        assert.deepEqual(await versionesRegistradas(), ['000']);
    });

    it('rechaza una migración nueva con número menor al de las ya aplicadas', async () => {
        await writeFile(path.join(carpeta, '000_a.sql'), 'SELECT 1;');
        await writeFile(path.join(carpeta, '002_c.sql'), 'SELECT 1;');
        await aplicarMigraciones(client, carpeta);

        await writeFile(path.join(carpeta, '001_b.sql'), 'SELECT 1;');
        await assert.rejects(
            () => aplicarMigraciones(client, carpeta),
            /anterior a otras ya aplicadas/,
        );
    });

    it('rechaza versiones repetidas', async () => {
        await writeFile(path.join(carpeta, '001_a.sql'), 'SELECT 1;');
        await writeFile(path.join(carpeta, '001_b.sql'), 'SELECT 1;');
        await assert.rejects(() => aplicarMigraciones(client, carpeta), /repetida/);
    });

    it('baseline: anota como aplicadas las migraciones de una base ya existente sin ejecutarlas', async () => {
        // una base "vieja": tiene las tablas pero nunca tuvo registro
        await client.query('CREATE TABLE usuarios (id INT)');

        const marcadas = await marcarComoAplicadas(client, '003');

        assert.deepEqual(marcadas, ['000', '001', '002', '003']);
        assert.deepEqual(await aplicarMigraciones(client), []); // ya no hay nada pendiente
        assert.equal(await existe('autores'), false); // y no se ejecutó ninguna: no se crearon tablas
    });

    it('baseline se niega en una base vacía y si ya hay registro', async () => {
        await assert.rejects(() => marcarComoAplicadas(client, '003'), /vacía/);

        await aplicarMigraciones(client);
        await assert.rejects(() => marcarComoAplicadas(client, '003'), /ya tiene migraciones/);
    });

    it('estado: distingue aplicadas de pendientes', async () => {
        await writeFile(path.join(carpeta, '000_a.sql'), 'SELECT 1;');
        await aplicarMigraciones(client, carpeta);
        await writeFile(path.join(carpeta, '001_b.sql'), 'SELECT 1;');

        const estado = await estadoMigraciones(client, carpeta);
        assert.deepEqual(
            estado.map((e) => [e.version, e.estado]),
            [
                ['000', 'aplicada'],
                ['001', 'pendiente'],
            ],
        );
    });
});
