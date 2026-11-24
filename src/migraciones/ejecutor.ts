// Ejecutor de migraciones: aplica los archivos de db/migrations/ en orden y deja constancia
// de cuáles ya corrieron en la tabla schema_migrations. No conoce Express ni la config de la app.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientBase } from 'pg';

// Desde src/migraciones (desarrollo) y desde dist/migraciones (producción) la ruta relativa es la misma.
export const DIRECTORIO_MIGRACIONES = new URL('../../db/migrations/', import.meta.url);

// Número arbitrario pero fijo: dos ejecutores a la vez (dos instancias, dos terminales) se turnan.
const CLAVE_BLOQUEO = 727274;

// Primera línea del archivo para migraciones que no pueden ir dentro de una transacción
// (por ejemplo CREATE INDEX CONCURRENTLY).
const MARCA_SIN_TRANSACCION = '-- migrar:sin-transaccion';

export type Migracion = {
    version: string; // "001"
    nombre: string; // "agregar_rol_usuarios"
    sql: string;
    checksum: string;
    sinTransaccion: boolean;
};

type Aplicada = { version: string; nombre: string; checksum: string; aplicada_en: Date };

export type EstadoMigracion = {
    version: string;
    nombre: string;
    estado: 'aplicada' | 'pendiente';
    aplicadaEn: Date | null;
};

type Registro = (mensaje: string) => void;

// Los saltos de línea se normalizan: Git en Windows puede convertir LF en CRLF, y la huella
// de un mismo archivo no debe cambiar según el sistema operativo.
const calcularChecksum = (sql: string): string =>
    createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export const cargarMigraciones = async (
    directorio: URL | string = DIRECTORIO_MIGRACIONES,
): Promise<Migracion[]> => {
    // Acepta una URL (la carpeta del proyecto) o una ruta en texto (por ejemplo, una carpeta temporal en los tests)
    const carpeta = typeof directorio === 'string' ? directorio : fileURLToPath(directorio);
    const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql'));
    const migraciones: Migracion[] = [];

    for (const archivo of archivos) {
        const partes = /^(\d+)_(.+)\.sql$/.exec(archivo);
        const version = partes?.[1];
        const nombre = partes?.[2];
        if (!version || !nombre) {
            throw new Error(
                `Nombre de migración inválido: "${archivo}" (formato: 001_descripcion.sql)`,
            );
        }
        const sql = await readFile(path.join(carpeta, archivo), 'utf8');
        migraciones.push({
            version,
            nombre,
            sql,
            checksum: calcularChecksum(sql),
            sinTransaccion: sql.trimStart().startsWith(MARCA_SIN_TRANSACCION),
        });
    }

    migraciones.sort((a, b) => Number(a.version) - Number(b.version));

    for (let i = 1; i < migraciones.length; i++) {
        const anterior = migraciones[i - 1];
        const actual = migraciones[i];
        if (anterior && actual && Number(anterior.version) === Number(actual.version)) {
            throw new Error(`Versión de migración repetida: ${actual.version}`);
        }
    }
    return migraciones;
};

const crearRegistro = (client: ClientBase) =>
    client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version      VARCHAR(10) PRIMARY KEY,
            nombre       TEXT NOT NULL,
            checksum     CHAR(64) NOT NULL,
            aplicada_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

const leerAplicadas = async (client: ClientBase): Promise<Aplicada[]> => {
    const { rows } = await client.query<Aplicada>(
        'SELECT version, nombre, checksum, aplicada_en FROM schema_migrations ORDER BY version',
    );
    return rows;
};

const registrar = (client: ClientBase, m: Migracion) =>
    client.query('INSERT INTO schema_migrations (version, nombre, checksum) VALUES ($1, $2, $3)', [
        m.version,
        m.nombre,
        m.checksum,
    ]);

// Con el bloqueo tomado, nadie más puede migrar mientras esta conexión lo tenga.
const conBloqueo = async <T>(client: ClientBase, tarea: () => Promise<T>): Promise<T> => {
    await client.query('SELECT pg_advisory_lock($1)', [CLAVE_BLOQUEO]);
    try {
        return await tarea();
    } finally {
        // Si la conexión murió, el bloqueo ya se liberó solo: no hay que tapar el error original.
        await client.query('SELECT pg_advisory_unlock($1)', [CLAVE_BLOQUEO]).catch(() => undefined);
    }
};

// Las migraciones aplicadas son historia: no se editan ni se borran, se agrega una nueva.
const verificarHistorial = (migraciones: Migracion[], aplicadas: Aplicada[]) => {
    const porVersion = new Map(migraciones.map((m) => [m.version, m]));

    for (const aplicada of aplicadas) {
        const archivo = porVersion.get(aplicada.version);
        if (!archivo) {
            throw new Error(
                `La migración ${aplicada.version}_${aplicada.nombre} ya se aplicó, pero su archivo no existe`,
            );
        }
        if (archivo.checksum.trim() !== aplicada.checksum.trim()) {
            throw new Error(
                `La migración ${aplicada.version}_${aplicada.nombre} fue modificada después de aplicarse. ` +
                    'Restaura el archivo y crea una migración nueva con el cambio.',
            );
        }
    }

    const ultima = Math.max(-1, ...aplicadas.map((a) => Number(a.version)));
    const aplicadasSet = new Set(aplicadas.map((a) => a.version));
    for (const m of migraciones) {
        if (!aplicadasSet.has(m.version) && Number(m.version) < ultima) {
            throw new Error(
                `La migración ${m.version}_${m.nombre} es anterior a otras ya aplicadas. ` +
                    'Renómbrala con un número mayor al de la última aplicada.',
            );
        }
    }
};

const ejecutar = async (client: ClientBase, m: Migracion) => {
    if (m.sinTransaccion) {
        await client.query(m.sql);
        await registrar(client, m);
        return;
    }
    // La migración y su registro van juntos: o ocurren las dos cosas o ninguna.
    await client.query('BEGIN');
    try {
        await client.query(m.sql);
        await registrar(client, m);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
};

// Aplica las migraciones pendientes, en orden. Devuelve las versiones que aplicó.
export const aplicarMigraciones = async (
    client: ClientBase,
    directorio: URL | string = DIRECTORIO_MIGRACIONES,
    registro: Registro = () => undefined,
): Promise<string[]> => {
    const migraciones = await cargarMigraciones(directorio);

    return conBloqueo(client, async () => {
        await crearRegistro(client);
        const aplicadas = await leerAplicadas(client);
        verificarHistorial(migraciones, aplicadas);

        const hechas = new Set(aplicadas.map((a) => a.version));
        const pendientes = migraciones.filter((m) => !hechas.has(m.version));

        for (const m of pendientes) {
            try {
                await ejecutar(client, m);
            } catch (error) {
                const detalle = error instanceof Error ? error.message : String(error);
                throw new Error(`Falló la migración ${m.version}_${m.nombre}: ${detalle}`, {
                    cause: error,
                });
            }
            registro(`aplicada ${m.version}_${m.nombre}`);
        }
        return pendientes.map((m) => m.version);
    });
};

// Para una base que ya tiene las tablas pero nunca tuvo registro (creada antes de existir este
// ejecutor): anota como aplicadas las migraciones hasta `hastaVersion` SIN ejecutarlas.
export const marcarComoAplicadas = async (
    client: ClientBase,
    hastaVersion: string,
    directorio: URL | string = DIRECTORIO_MIGRACIONES,
): Promise<string[]> => {
    const migraciones = await cargarMigraciones(directorio);
    const limite = Number(hastaVersion);
    if (!migraciones.some((m) => Number(m.version) === limite)) {
        throw new Error(`No existe la migración ${hastaVersion}`);
    }

    return conBloqueo(client, async () => {
        const { rows } = await client.query<{ existe: string | null }>(
            "SELECT to_regclass('usuarios') AS existe",
        );
        if (!rows[0]?.existe) {
            throw new Error('La base está vacía: usa "migrar" para crearla, no "baseline"');
        }
        await crearRegistro(client);
        if ((await leerAplicadas(client)).length > 0) {
            throw new Error(
                'El registro ya tiene migraciones: baseline solo sirve en una base sin registro',
            );
        }

        const marcadas = migraciones.filter((m) => Number(m.version) <= limite);
        await client.query('BEGIN');
        try {
            for (const m of marcadas) await registrar(client, m);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        return marcadas.map((m) => m.version);
    });
};

export const estadoMigraciones = async (
    client: ClientBase,
    directorio: URL | string = DIRECTORIO_MIGRACIONES,
): Promise<EstadoMigracion[]> => {
    const migraciones = await cargarMigraciones(directorio);
    const { rows } = await client.query<{ existe: string | null }>(
        "SELECT to_regclass('schema_migrations') AS existe",
    );
    const aplicadas = rows[0]?.existe ? await leerAplicadas(client) : [];
    const porVersion = new Map(aplicadas.map((a) => [a.version, a]));

    return migraciones.map((m) => {
        const aplicada = porVersion.get(m.version);
        return {
            version: m.version,
            nombre: m.nombre,
            estado: aplicada ? 'aplicada' : 'pendiente',
            aplicadaEn: aplicada?.aplicada_en ?? null,
        };
    });
};
