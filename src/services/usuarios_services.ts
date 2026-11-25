import { AppError } from '../utils/AppError.js';
import { validarId, parsear } from '../schemas/comunes.js';
import { esquemaActualizarUsuario, esquemaRol } from '../schemas/usuarios.js';
import { paginarOffset, type ParametrosPagina } from '../utils/paginacion.js';
import * as repo from '../repositories/usuarios_repositories.js';
import type { ContextoAuditoria, UsuarioAutenticado } from '../types/dominio.js';
import { enTransaccion } from '../utils/transaccion.js';
import { registrarEn } from './auditoria_services.js';

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

export const eliminar = async (
    id: unknown,
    user: UsuarioAutenticado,
    contexto: ContextoAuditoria,
) => {
    const usuarioId = validarId(id);
    if (user.rol !== 'admin' && usuarioId !== user.id)
        throw new AppError(403, 'Solo puedes modificar tu propio usuario', 'PERMISO_DENEGADO');
    // si un admin no puede quitarse el rol ni borrarse, siempre queda al menos uno
    if (user.rol === 'admin' && usuarioId === user.id)
        throw new AppError(400, 'Un admin no puede borrarse a sí mismo; pídeselo a otro admin');
    // Borrado y auditoría juntos. No se guarda el email del usuario borrado: la auditoría no debe
    // conservar datos personales de alguien que ya no existe.
    await enTransaccion(async (client) => {
        const eliminado = await repo.eliminar(client, usuarioId);
        if (!eliminado) throw new AppError(404, 'Usuario no encontrado');
        await registrarEn(client, {
            accion: 'usuario_eliminado',
            actorId: user.id,
            objetivoId: usuarioId,
            detalle: { autoeliminado: usuarioId === user.id },
            contexto,
        });
    });
};

export const cambiarRol = async (
    id: unknown,
    datos: unknown,
    user: UsuarioAutenticado,
    contexto: ContextoAuditoria,
) => {
    const usuarioId = validarId(id);
    // z.enum(ROLES): `rol` sale tipado como Rol, sin type guard manual
    const { rol } = parsear(esquemaRol, datos);
    //evita que el ultimo admin se quite el rol a si mismo
    if (usuarioId === user.id && rol !== 'admin')
        throw new AppError(400, 'No puedes quitarte el rol de admin a ti mismo');

    return enTransaccion(async (client) => {
        const cambiado = await repo.cambiarRol(client, usuarioId, rol);
        if (!cambiado) throw new AppError(404, 'Usuario no encontrado');
        // rol_anterior es solo para la auditoría: la respuesta de la API no cambia
        const { rol_anterior: anterior, ...usuario } = cambiado;
        if (anterior !== rol) {
            await registrarEn(client, {
                accion: 'rol_cambiado',
                actorId: user.id,
                objetivoId: usuarioId,
                detalle: { de: anterior, a: rol },
                contexto,
            });
        }
        return usuario;
    });
};
