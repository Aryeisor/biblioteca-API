import { AppError } from '../utils/AppError.js';
import { validarId, validarEntero } from '../utils/validators.js';
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

// Cursor opaco: el cliente no ve un id sino {"id":N} en Base64url. Si mañana se ordena por fecha,
// se cambia lo que va dentro sin romper a nadie, porque ningún cliente armaba cursores a mano.
const codificarCursor = (id: number): string =>
    Buffer.from(JSON.stringify({ id })).toString('base64url');

const decodificarCursor = (cursor: unknown): number | null => {
    if (cursor === undefined) return null;
    try {
        if (typeof cursor !== 'string') throw new Error('el cursor no es texto');
        // JSON.parse devuelve any: se declara unknown el id y validarId lo comprueba
        const { id }: { id?: unknown } = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        return validarId(id);
    } catch {
        // cualquier fallo (no es Base64, no es JSON, id no válido) es el mismo error para el cliente
        throw new AppError(400, 'Cursor inválido', 'CURSOR_INVALIDO');
    }
};

type FiltroPrestamos = { activos?: unknown; cursor?: unknown; limite?: unknown };

export const listar = async (
    { activos, cursor, limite }: FiltroPrestamos = {},
    user: UsuarioAutenticado,
) => {
    const limiteNum = validarEntero(limite, 'limite', 1, 100, 20);
    const cursorId = decodificarCursor(cursor);

    const filas = await repo.listar(
        activos === 'true',
        user.rol === 'lector' ? user.id : null,
        cursorId,
        limiteNum,
    );

    const hayMas = filas.length > limiteNum;
    const data = hayMas ? filas.slice(0, limiteNum) : filas; // la fila extra solo avisa, no se devuelve
    // .at(-1) es "Prestamo | undefined": si hayMas, data nunca está vacío, pero TypeScript no lo sabe
    const ultima = data.at(-1);
    return {
        data,
        paginacion: {
            limite: limiteNum,
            siguienteCursor: hayMas && ultima ? codificarCursor(ultima.id) : null,
        },
    };
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
