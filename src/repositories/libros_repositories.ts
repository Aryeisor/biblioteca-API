import { eq } from 'drizzle-orm';
import type { PoolClient } from 'pg';
import pool from '../config/db.js';
import { db } from '../orm/cliente.js';
import { autores, libros } from '../orm/esquema.js';
import type { FilaConTotal, Id, Libro, LibroBloqueado } from '../types/dominio.js';
import type { DatosLibro } from '../schemas/libros.js';
import { primeraFila } from '../utils/filas.js';

// PR 7: las consultas simples (buscarPorId, crear, actualizar, eliminar, actualizarStock) usan Drizzle.
// Se quedan en SQL a mano: `listar` (COUNT(*) OVER() para el total) y `bloquearPorId` / `cambiarStock`
// (FOR UPDATE sobre el PoolClient de la transacción de préstamos). Las firmas exportadas no cambian.

// Columnas de un libro con el nombre del autor (JOIN). El orden de las claves es el orden del JSON de la API.
// El tipo de retorno `Libro` comprueba que lo inferido desde el esquema coincide con el tipo del dominio.
const columnasLibro = {
    id: libros.id,
    titulo: libros.titulo,
    isbn: libros.isbn,
    stock: libros.stock,
    autor_id: libros.autor_id,
    autor: autores.nombre,
};

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
    const [libro] = await db
        .select(columnasLibro)
        .from(libros)
        .innerJoin(autores, eq(autores.id, libros.autor_id))
        .where(eq(libros.id, id));
    return libro;
};

export const crear = async ({ titulo, isbn, autorId, stock }: DatosLibro): Promise<Id> => {
    const filas = await db
        .insert(libros)
        .values({ titulo, isbn, autor_id: autorId, stock })
        .returning({ id: libros.id });
    return primeraFila(filas, 'INSERT libros');
};

export const actualizar = async (
    id: number,
    { titulo, isbn, autorId, stock }: DatosLibro,
): Promise<Id | undefined> => {
    const [fila] = await db
        .update(libros)
        .set({ titulo, isbn, autor_id: autorId, stock })
        .where(eq(libros.id, id))
        .returning({ id: libros.id });
    return fila;
};

export const eliminar = async (id: number): Promise<boolean> => {
    const filas = await db.delete(libros).where(eq(libros.id, id)).returning({ id: libros.id });
    return filas.length > 0;
};

export const actualizarStock = async (
    id: number,
    { stock }: { stock: number },
): Promise<Id | undefined> => {
    const [fila] = await db
        .update(libros)
        .set({ stock })
        .where(eq(libros.id, id))
        .returning({ id: libros.id });
    return fila;
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
