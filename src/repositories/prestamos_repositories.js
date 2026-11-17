import pool from '../config/db.js';

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
export const listar = async (soloActivos = false, usuarioId = null, cursorId = null, limite = 20) =>{
  const condiciones = [];
  const params = [];
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
  const {rows} = await pool.query(`${SELECT_BASE} ${where} ORDER BY p.id DESC LIMIT $${params.length}`, params);
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
    'SELECT id, libro_id, usuario_id, fecha_devolucion FROM prestamos WHERE id = $1 FOR UPDATE', [id]);
  return rows[0];
};

export const marcarDevuelto = async(client, id) =>{
   await client.query(`UPDATE prestamos 
    SET fecha_devolucion = NOW() WHERE id = $1`, [id]); 
};
