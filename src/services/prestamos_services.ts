import { AppError } from '../utils/AppError.js';
import { validarId, parsear } from '../schemas/comunes.js';
import { esquemaLimitePrestamos } from '../schemas/prestamos.js';
import { decodificarCursor, paginarPorCursor } from '../utils/cursor.js';
import pool from '../config/db.js';
import * as librosrepo from '../repositories/libros_repositories.js';
import * as usuariosrepo from '../repositories/usuarios_repositories.js';
import * as repo from '../repositories/prestamos_repositories.js';
import type { UsuarioAutenticado } from '../types/dominio.js';

//validar libro id y usuario id

export const prestar = async (
    libroId: unknown,
    usuarioIdBody: unknown,
    user: UsuarioAutenticado,
) => {
    const lid = validarId(libroId, 'libroId');
    const uid = user.rol === 'lector' ? user.id : validarId(usuarioIdBody ?? user.id, 'usuarioId');

    const usuario = await usuariosrepo.buscarPorId(uid);
    if (!usuario) throw new AppError(404, 'Usuario no encontrado');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const libro = await librosrepo.bloquearPorId(client, lid);
        if (!libro) throw new AppError(404, 'Libro no encontrado');
        if (libro.stock < 1) throw new AppError(409, 'No hay stock suficiente');

        await librosrepo.cambiarStock(client, lid, -1);
        const { id } = await repo.crear(client, lid, uid);

        await client.query('COMMIT');
        return repo.buscarPorId(id);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

type FiltroPrestamos = { activos?: unknown; cursor?: unknown; limite?: unknown };

export const listar = async (
    { activos, cursor, limite }: FiltroPrestamos = {},
    user: UsuarioAutenticado,
) => {
    const limiteNum = parsear(esquemaLimitePrestamos, limite);
    const cursorId = decodificarCursor(cursor);

    const filas = await repo.listar(
        activos === 'true',
        user.rol === 'lector' ? user.id : null,
        cursorId,
        limiteNum,
    );

    return paginarPorCursor(filas, limiteNum);
};

// solo bibliotecario/admin llegan aquí (lo filtra la ruta) y pueden devolver cualquiera
export const devolver = async (id: unknown) => {
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
        if (!prestamo) throw new AppError(404, 'Préstamo no encontrado');

        // 6. si ya tiene fecha_devolucion -> 409
        if (prestamo.fecha_devolucion !== null) {
            throw new AppError(409, 'El préstamo ya fue devuelto');
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

export const obtener = async (id: unknown, user: UsuarioAutenticado) => {
    const prestamo = await repo.buscarPorId(validarId(id, 'ID'));
    if (!prestamo) throw new AppError(404, 'Prestamo no encontrado');
    if (user.rol === 'lector' && prestamo.usuario_id !== user.id) {
        throw new AppError(403, 'Solo puedes ver tus propios préstamos', 'PERMISO_DENEGADO');
    }
    return prestamo;
};
