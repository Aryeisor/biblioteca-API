import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { limpiarTablas, cerrarPool } from './helpers.js';

// Prueba las reglas que ahora viven en la base de datos, saltándose la API a propósito:
// lo que importa es que un INSERT/UPDATE directo tampoco pueda romperlas.

before(limpiarTablas);
after(cerrarPool);

const codigoError = async (consulta: Promise<unknown>): Promise<string | undefined> => {
    try {
        await consulta;
        return undefined;
    } catch (error) {
        return (error as { code?: string }).code;
    }
};

describe('Esquema endurecido', () => {
    it('no permite dos emails que solo difieren en mayúsculas (23505)', async () => {
        await pool.query(
            "INSERT INTO usuarios (nombre, email, password) VALUES ('A', 'ana@correo.com', 'hash')",
        );
        const codigo = await codigoError(
            pool.query(
                "INSERT INTO usuarios (nombre, email, password) VALUES ('B', 'ANA@Correo.com', 'hash')",
            ),
        );
        assert.equal(codigo, '23505');
    });

    it('no permite un usuario sin password (23502)', async () => {
        const codigo = await codigoError(
            pool.query(
                "INSERT INTO usuarios (nombre, email, password) VALUES ('C', 'sinclave@correo.com', NULL)",
            ),
        );
        assert.equal(codigo, '23502');
    });

    it('updated_at avanza en cada UPDATE, aunque el UPDATE no lo mencione', async () => {
        const { rows } = await pool.query<{ id: number }>(
            "INSERT INTO autores (nombre) VALUES ('Gabo') RETURNING id",
        );
        const id = rows[0]?.id;
        assert.ok(id);

        const leer = async (): Promise<number> => {
            const r = await pool.query<{ updated_at: Date }>(
                'SELECT updated_at FROM autores WHERE id = $1',
                [id],
            );
            return r.rows[0]!.updated_at.getTime();
        };

        const antes = await leer();
        await new Promise((resolve) => setTimeout(resolve, 20));
        await pool.query("UPDATE autores SET nombre = 'Gabriel' WHERE id = $1", [id]);
        assert.ok((await leer()) > antes, 'updated_at debería avanzar');
    });
});
