import type { PoolClient } from 'pg';
import pool from '../config/db.js';

// BEGIN / COMMIT / ROLLBACK y liberar la conexión, en un solo lugar.
// Si la función lanza, se hace ROLLBACK y el error sigue su camino.
export const enTransaccion = async <T>(trabajo: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resultado = await trabajo(client);
        await client.query('COMMIT');
        return resultado;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};
