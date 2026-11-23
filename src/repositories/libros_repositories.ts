import type { PoolClient } from 'pg';
import pool from '../config/db.js';
import type { DatosLibro, FilaConTotal, Id, Libro, LibroBloqueado } from '../types/dominio.js';
import { primeraFila } from '../utils/filas.js';

const SELECT_BASE = `
  SELECT l.id, l.titulo, l.isbn, l.stock, l.autor_id, a.nombre AS autor
  FROM libros l
  JOIN autores a ON a.id = l.autor_id
`;
//$1: el parámetro. Se reemplaza por el primer valor del arreglo [titulo].
//::text: es un cast, o sea “trata este valor como texto”. PostgreSQL necesita saber el tipo del parámetro cuando es NULL; sin el cast, a veces da error de tipo (“could not determine data type of parameter $1”). Se pone una sola vez, en la primera aparición.
//ILIKE: como LIKE (buscar por patrón) pero ignora mayúsculas y minúsculas. 'cien' encuentra “Cien años de soledad”.
//'%' || $1 || '%': || en SQL concatena texto. Y % significa “cualquier cosa”. Si $1 es cien, queda:
//'%cien%'  →  "cualquier cosa + cien + cualquier cosa"
//Es decir, que cien aparezca en cualquier parte del título.
//ORDER BY l.id: ordena los resultados por id para que siempre salgan en el mismo orden.
//COUNT(*) OVER(): window function. Cuenta las filas que cumplen el WHERE ANTES del LIMIT y pega ese total en cada fila.
//LIMIT $2: cuántas filas devolver (tamaño de página). OFFSET $3: cuántas saltarse (pagina - 1) * limite.
//Si limite es null, PostgreSQL lo toma como LIMIT ALL (sin límite).
//
// Ojo: "titulo = null" sin anotar el tipo haría que TypeScript infiera el tipo `null` (y nada más).
export const listar = async (
    titulo: string | null = null,
    limite: number | null = null,
    offset = 0,
): Promise<FilaConTotal<Libro>[]> => {
    const { rows } = await pool.query<FilaConTotal<Libro>>(
        `
     SELECT l.id, l.titulo, l.isbn, l.stock, l.autor_id, a.nombre AS autor,
            COUNT(*) OVER() AS total
     FROM libros l
     JOIN autores a ON a.id = l.autor_id
     WHERE ($1::text IS NULL OR l.titulo ILIKE '%' || $1 || '%')
     ORDER BY l.id
     LIMIT $2 OFFSET $3`,
        [titulo, limite, offset],
    );

    return rows;
};

export const buscarPorId = async (id: number): Promise<Libro | undefined> => {
    const { rows } = await pool.query<Libro>(`${SELECT_BASE} WHERE l.id = $1`, [id]);
    return rows[0];
};

export const crear = async ({ titulo, isbn, autorId, stock }: DatosLibro): Promise<Id> => {
    const { rows } = await pool.query<Id>(
        `INSERT INTO libros (titulo, isbn, autor_id, stock)
     VALUES ($1, $2, $3, $4) RETURNING id`,
        [titulo, isbn, autorId, stock],
    );

    return primeraFila(rows, 'INSERT libros');
};

export const actualizar = async (
    id: number,
    { titulo, isbn, autorId, stock }: DatosLibro,
): Promise<Id | undefined> => {
    const { rows } = await pool.query<Id>(
        `UPDATE libros
     SET titulo = $1, isbn = $2, autor_id = $3, stock = $4
     WHERE id = $5 RETURNING id`,
        [titulo, isbn, autorId, stock, id],
    );

    return rows[0];
};

export const eliminar = async (id: number): Promise<boolean> => {
    const { rowCount } = await pool.query('DELETE FROM libros WHERE id = $1', [id]);

    return (rowCount ?? 0) > 0;
};

export const actualizarStock = async (
    id: number,
    { stock }: { stock: number },
): Promise<Id | undefined> => {
    const { rows } = await pool.query<Id>(
        `UPDATE libros
     SET stock = $1 WHERE id = $2 RETURNING id`,
        [stock, id],
    );
    return rows[0];
};

// client: la conexión de la transacción abierta por el servicio (por eso no usa el pool)
export const bloquearPorId = async (
    client: PoolClient,
    id: number,
): Promise<LibroBloqueado | undefined> => {
    const { rows } = await client.query<LibroBloqueado>(
        'SELECT id, stock FROM libros WHERE id = $1 FOR UPDATE',
        [id],
    );
    return rows[0];
};

export const cambiarStock = async (
    client: PoolClient,
    id: number,
    delta: number,
): Promise<void> => {
    await client.query('UPDATE libros SET stock = stock + $1 WHERE id = $2', [delta, id]);
};
