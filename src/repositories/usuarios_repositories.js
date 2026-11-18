import pool from '../config/db.js';

// COUNT(*) OVER(): total de usuarios antes del LIMIT, repetido en cada fila. limite null = LIMIT ALL.
export const listar = async (limite = null, offset = 0) => {
    const { rows } = await pool.query(
        `SELECT id, nombre, email, created_at, COUNT(*) OVER() AS total
     FROM usuarios ORDER BY id LIMIT $1 OFFSET $2`,
        [limite, offset],
    );
    return rows;
};

export const buscarPorId = async (id) => {
    const { rows } = await pool.query(
        'SELECT id, nombre, email, created_at FROM usuarios WHERE id = $1',
        [id],
    );
    return rows[0];
};

export const crearConPassword = async (nombre, email, passwordHash) => {
    const { rows } = await pool.query(
        'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email, created_at ',
        [nombre, email, passwordHash],
    );
    return rows[0];
};

export const buscarPorEmail = async (email) => {
    const { rows } = await pool.query(
        'SELECT id, nombre, email, password, rol FROM usuarios WHERE email = $1',
        [email],
    );
    return rows[0];
};

export const actualizar = async (id, nombre, email) => {
    const { rows } = await pool.query(
        'UPDATE usuarios SET nombre =  $1, email = $2 WHERE id = $3 RETURNING id, nombre, email, created_at',
        [nombre, email, id],
    );
    return rows[0];
};

export const eliminar = async (id) => {
    const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return rowCount > 0;
};

export const cambiarRol = async (id, rol) => {
    const { rows } = await pool.query(
        'UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id, nombre, email, rol, created_at',
        [rol, id],
    );
    return rows[0];
};
