import pool from "../config/db.js";

export const listar = async() => {
    const {rows} = await pool.query('SELECT * FROM usuarios ORDER BY id');
    return rows;
};

export const buscarPorId = async (id) =>{
    const {rows} = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return rows[0];
};

export const crear = async(nombre,email) => {
    const {rows}= await pool.query('INSERT INTO usuarios (nombre, email) VALUES ($1, $2) RETURNING *', [nombre,email]);
    return rows[0];
};

export const actualizar = async(id, nombre, email) => {
    const {rows} = await pool.query('UPDATE usuarios SET nombre =  $1, email = $2 WHERE id = $3 RETURNING *', [nombre, email, id]);
    return rows[0];
};

export const eliminar = async (id) => {
    const {rowCount} = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return rowCount > 0;
};