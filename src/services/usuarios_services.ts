import { AppError } from '../utils/AppError.js';
import { validarId, parsear } from '../schemas/comunes.js';
import { esquemaActualizarUsuario, esquemaRol } from '../schemas/usuarios.js';
import { paginarOffset, type ParametrosPagina } from '../utils/paginacion.js';
import * as repo from '../repositories/usuarios_repositories.js';
import type { UsuarioAutenticado } from '../types/dominio.js';

export const listar = ({ pagina, limite }: ParametrosPagina = {}) =>
    paginarOffset({ pagina, limite }, repo.listar);

export const obtener = async (id: unknown, user: UsuarioAutenticado) => {
    const usuarioId = validarId(id);
    if (user.rol === 'lector' && usuarioId !== user.id)
        throw new AppError(403, 'Solo puedes ver tu propio usuario', 'PERMISO_DENEGADO');
    const usuario = await repo.buscarPorId(usuarioId);
    if (!usuario) throw new AppError(404, 'Usuario no encontrado');
    return usuario;
};

export const actualizar = async (id: unknown, datos: unknown, user: UsuarioAutenticado) => {
    const usuarioId = validarId(id);
    if (user.rol !== 'admin' && usuarioId !== user.id)
        throw new AppError(403, 'Solo puedes modificar tu propio usuario', 'PERMISO_DENEGADO');
    const { nombre, email } = parsear(esquemaActualizarUsuario, datos);

    const usuario = await repo.actualizar(usuarioId, nombre, email);
    if (!usuario) throw new AppError(404, 'Usuario no encontrado');
    return usuario;
};

export const eliminar = async (id: unknown, user: UsuarioAutenticado) => {
    const usuarioId = validarId(id);
    if (user.rol !== 'admin' && usuarioId !== user.id)
        throw new AppError(403, 'Solo puedes modificar tu propio usuario', 'PERMISO_DENEGADO');
    // si un admin no puede quitarse el rol ni borrarse, siempre queda al menos uno
    if (user.rol === 'admin' && usuarioId === user.id)
        throw new AppError(400, 'Un admin no puede borrarse a sí mismo; pídeselo a otro admin');
    const eliminado = await repo.eliminar(usuarioId);
    if (!eliminado) throw new AppError(404, 'Usuario no encontrado');
};

export const cambiarRol = async (id: unknown, datos: unknown, user: UsuarioAutenticado) => {
    const usuarioId = validarId(id);
    // z.enum(ROLES): `rol` sale tipado como Rol, sin type guard manual
    const { rol } = parsear(esquemaRol, datos);
    //evita que el ultimo admin se quite el rol a si mismo
    if (usuarioId === user.id && rol !== 'admin')
        throw new AppError(400, 'No puedes quitarte el rol de admin a ti mismo');

    const usuario = await repo.cambiarRol(usuarioId, rol);
    if (!usuario) throw new AppError(404, 'Usuario no encontrado');
    return usuario;
};
