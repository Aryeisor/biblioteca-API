import pool from "../config/db.js";

//Solo SQL, nada de reglas de negocio

export const listar = async () =>{
    const { rows } = await pool.query('SELECT * FROM autores ORDER BY id');
    return rows;
};

export const buscarPorId = async (id) => {
    const { rows } = await pool.query('SELECT * FROM autores WHERE id = $1', [id]);
    return rows[0];
};

export const crear = async (nombre) => {
    const { rows } = await pool.query('INSERT INTO autores (nombre) VALUES ($1) RETURNING *', [nombre]);
    return rows[0];
};

export const actualizar = async (id, nombre) => {
    const {rows} = await pool.query('UPDATE autores SET nombre = $1 WHERE id = $2 RETURNING *', [nombre,id]);
    return rows[0]
};

export const eliminar = async(id) => {
    const {rowCount} = await pool.query('DELETE FROM autores WHERE id = $1', [id]);
    return rowCount > 0;
}