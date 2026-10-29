import pool from '../config/db.js';
import * as librosrepo from '../repositories/libros_repositories.js';
import * as usuariosrepo from '../repositories/usuarios_repositories.js';
import * as repo from '../repositories/prestamos_repositories.js';

//validar libro id y usuario id
const validarId = (id, nombre = 'ID') => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw { status: 400, message: `${nombre} inválido` };
  }
  return n;
};


export const prestar = async (libroId,usuarioId) => {
    const lid = validarId (libroId, "libroId");
    const uid = validarId (usuarioId, "usuarioId");

    const usuario = await usuariosrepo.buscarPorId(uid);
        if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const libro = await librosrepo.bloquearPorId(client,lid);
            if(!libro) throw ({status:404, message: 'Libro no encontrado'})
            if(libro.stock < 1) throw ({status:409, message: 'No hay stock suficiente'});
            
            await librosrepo.cambiarStock(client, lid, -1);
            const { id } = await repo.crear(client, lid, uid);

            await client.query('COMMIT');
            return repo.buscarPorId(id);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally{
            client.release();
        };
};

export const listar = () => repo.listar();


export const devolver = async (id) =>{
    // 1. validar el id
  const pid = validarId(id, 'ID');

  // 2. pedir una conexión al pool
  const client = await pool.connect();
  try {
    // 3. BEGIN
    await client.query('BEGIN');

    // 4. bloquear el préstamo
    const prestamo = await repo.bloquearPorId(client, pid);

    // 5. si no existe -> 404
    if (!prestamo) throw { status: 404, message: 'Préstamo no encontrado' };

    // 6. si ya tiene fecha_devolucion -> 409
    if (prestamo.fecha_devolucion !== null) {
      throw { status: 409, message: 'El préstamo ya fue devuelto' };
    }

    // 7. marcarlo como devuelto
    await repo.marcarDevuelto(client, pid);

    // 8. subir el stock del libro en +1
    await librosrepo.cambiarStock(client, prestamo.libro_id, 1);

    // 9. COMMIT
    await client.query('COMMIT');

    // 10. devolver el préstamo actualizado
    return repo.buscarPorId(pid);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
};