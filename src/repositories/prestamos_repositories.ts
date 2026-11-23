import type { PoolClient } from 'pg';
import pool from '../config/db.js';
import type { Id, Prestamo, PrestamoBloqueado } from '../types/dominio.js';
import { primeraFila } from '../utils/filas.js';

const SELECT_BASE = `
  SELECT p.id, p.fecha_prestamo, p.fecha_devolucion,
         p.libro_id, l.titulo AS libro,
         p.usuario_id, u.nombre AS usuario
  FROM prestamos p
  JOIN libros l ON l.id = p.libro_id
  JOIN usuarios u ON u.id = p.usuario_id
`;

// usuarioId null = todos los usuarios. cursorId null = primera página.
// Orden del más reciente al más viejo: la página siguiente son los ids MENORES que el último visto.
// Pide limite + 1 filas: si llega la extra, el servicio sabe que hay otra página sin hacer un COUNT.
export const listar = async (
    soloActivos = false,
    usuarioId: number | null = null,
    cursorId: number | null = null,
    limite = 20,
): Promise<Prestamo[]> => {
    // Sin anotar, TypeScript no sabe qué guardará cada arreglo vacío
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (soloActivos) condiciones.push('p.fecha_devolucion IS NULL');
    if (usuarioId !== null) {
        params.push(usuarioId);
        condiciones.push(`p.usuario_id = $${params.length}`);
    }
    if (cursorId !== null) {
        params.push(cursorId);
        condiciones.push(`p.id < $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    params.push(limite + 1);
    const { rows } = await pool.query<Prestamo>(
        `${SELECT_BASE} ${where} ORDER BY p.id DESC LIMIT $${params.length}`,
        params,
    );
    return rows;
};

export const buscarPorId = async (id: number): Promise<Prestamo | undefined> => {
    const { rows } = await pool.query<Prestamo>(
        `${SELECT_BASE}
        WHERE p.id = $1`,
        [id],
    );
    return rows[0];
};

export const crear = async (
    client: PoolClient,
    libroId: number,
    usuarioId: number,
): Promise<Id> => {
    const { rows } = await client.query<Id>(
        `INSERT INTO prestamos (libro_id, usuario_id)
     VALUES ($1, $2) RETURNING id`,
        [libroId, usuarioId],
    );
    return primeraFila(rows, 'INSERT prestamos');
};

export const bloquearPorId = async (
    client: PoolClient,
    id: number,
): Promise<PrestamoBloqueado | undefined> => {
    const { rows } = await client.query<PrestamoBloqueado>(
        'SELECT id, libro_id, usuario_id, fecha_devolucion FROM prestamos WHERE id = $1 FOR UPDATE',
        [id],
    );
    return rows[0];
};

export const marcarDevuelto = async (client: PoolClient, id: number): Promise<void> => {
    await client.query(
        `UPDATE prestamos
    SET fecha_devolucion = NOW() WHERE id = $1`,
        [id],
    );
};
