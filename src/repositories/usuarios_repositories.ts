import type { PoolClient } from 'pg';
import pool from '../config/db.js';
import type {
    FilaConTotal,
    Usuario,
    UsuarioConCredenciales,
    UsuarioConRol,
    Rol,
} from '../types/dominio.js';
import { primeraFila } from '../utils/filas.js';

// COUNT(*) OVER(): total de usuarios antes del LIMIT, repetido en cada fila. limite null = LIMIT ALL.
export const listar = async (
    limite: number | null = null,
    offset = 0,
): Promise<FilaConTotal<Usuario>[]> => {
    const { rows } = await pool.query<FilaConTotal<Usuario>>(
        `SELECT id, nombre, email, created_at, COUNT(*) OVER() AS total
     FROM usuarios ORDER BY id LIMIT $1 OFFSET $2`,
        [limite, offset],
    );
    return rows;
};

export const buscarPorId = async (id: number): Promise<Usuario | undefined> => {
    const { rows } = await pool.query<Usuario>(
        'SELECT id, nombre, email, created_at FROM usuarios WHERE id = $1',
        [id],
    );
    return rows[0];
};

export const crearConPassword = async (
    nombre: string,
    email: string,
    passwordHash: string,
): Promise<Usuario> => {
    const { rows } = await pool.query<Usuario>(
        'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email, created_at ',
        [nombre, email, passwordHash],
    );
    return primeraFila(rows, 'INSERT usuarios');
};

// Es la única consulta que devuelve el hash de la contraseña: solo la usa el login
export const buscarPorEmail = async (
    email: string,
): Promise<UsuarioConCredenciales | undefined> => {
    const { rows } = await pool.query<UsuarioConCredenciales>(
        'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = $1',
        [email],
    );
    return rows[0];
};

export const actualizar = async (
    id: number,
    nombre: string,
    email: string,
): Promise<Usuario | undefined> => {
    const { rows } = await pool.query<Usuario>(
        'UPDATE usuarios SET nombre =  $1, email = $2 WHERE id = $3 RETURNING id, nombre, email, created_at',
        [nombre, email, id],
    );
    return rows[0];
};

export const eliminar = async (client: PoolClient, id: number): Promise<boolean> => {
    const { rowCount } = await client.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
};

// Devuelve también el rol anterior (para la auditoría). FOR UPDATE: lo lee y lo cambia sin que otro
// cambio de rol se cuele en medio.
export const cambiarRol = async (
    client: PoolClient,
    id: number,
    rol: Rol,
): Promise<(UsuarioConRol & { rol_anterior: Rol }) | undefined> => {
    const { rows } = await client.query<UsuarioConRol & { rol_anterior: Rol }>(
        `WITH anterior AS (SELECT id, rol FROM usuarios WHERE id = $2 FOR UPDATE)
         UPDATE usuarios u SET rol = $1 FROM anterior a WHERE u.id = a.id
         RETURNING u.id, u.nombre, u.email, u.rol, u.created_at, a.rol AS rol_anterior`,
        [rol, id],
    );
    return rows[0];
};

// El refresh vuelve a leer el rol: un cambio de rol se aplica en el siguiente refresh, no al vencer la sesión
export const buscarRolPorId = async (
    client: PoolClient,
    id: number,
): Promise<{ id: number; rol: Rol } | undefined> => {
    const { rows } = await client.query<{ id: number; rol: Rol }>(
        'SELECT id, rol FROM usuarios WHERE id = $1',
        [id],
    );
    return rows[0];
};
