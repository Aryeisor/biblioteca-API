import pool from '../config/db.js';

const SELECT_BASE = `
  SELECT p.id, p.fecha_prestamo, p.fecha_devolucion,
         p.libro_id, l.titulo AS libro,
         p.usuario_id, u.nombre AS usuario
  FROM prestamos p
  JOIN libros l ON l.id = p.libro_id
  JOIN usuarios u ON u.id = p.usuario_id
`;

export const listar = async () =>{
    const {rows} = await pool.query(`${SELECT_BASE}
        ORDER BY p.id `);
    return rows;    
};

export const buscarPorId = async (id) =>{
    const {rows} = await pool.query(`${SELECT_BASE}
        WHERE p.id = $1`, [id]);
    return rows[0];    
};

export const crear = async (client, libroId, usuarioId) => {
  const { rows } = await client.query(
    `INSERT INTO prestamos (libro_id, usuario_id)
     VALUES ($1, $2) RETURNING id`,
    [libroId, usuarioId]
  );
  return rows[0];
};

export const bloquearPorId = async (client, id) => {
  const { rows } = await client.query(
    'SELECT id, libro_id, fecha_devolucion FROM prestamos WHERE id = $1 FOR UPDATE', [id]);
  return rows[0];
};

export const marcarDevuelto = async(client, id) =>{
   await client.query(`UPDATE prestamos 
    SET fecha_devolucion = NOW() WHERE id = $1`, [id]); 
};