import pool from '../config/db.js';
import type { Autor } from '../types/dominio.js';
import { primeraFila } from '../utils/filas.js';

//Solo SQL, nada de reglas de negocio

// Columnas explícitas (no "*"): así updated_at y futuras columnas internas no se filtran a la API.
const COLUMNAS = 'id, nombre, created_at';

export const listar = async (): Promise<Autor[]> => {
    const { rows } = await pool.query<Autor>(`SELECT ${COLUMNAS} FROM autores ORDER BY id`);
    return rows;
};

// rows[0] es "Autor | undefined" (noUncheckedIndexedAccess): el servicio decide si es un 404
export const buscarPorId = async (id: number): Promise<Autor | undefined> => {
    const { rows } = await pool.query<Autor>(`SELECT ${COLUMNAS} FROM autores WHERE id = $1`, [id]);
    return rows[0];
};

export const crear = async (nombre: string): Promise<Autor> => {
    const { rows } = await pool.query<Autor>(
        `INSERT INTO autores (nombre) VALUES ($1) RETURNING ${COLUMNAS}`,
        [nombre],
    );
    return primeraFila(rows, 'INSERT autores');
};

export const actualizar = async (id: number, nombre: string): Promise<Autor | undefined> => {
    const { rows } = await pool.query<Autor>(
        `UPDATE autores SET nombre = $1 WHERE id = $2 RETURNING ${COLUMNAS}`,
        [nombre, id],
    );
    return rows[0];
};

export const eliminar = async (id: number): Promise<boolean> => {
    const { rowCount } = await pool.query('DELETE FROM autores WHERE id = $1', [id]);
    // rowCount es "number | null" en los tipos de pg (null en comandos que no cuentan filas)
    return (rowCount ?? 0) > 0;
};
