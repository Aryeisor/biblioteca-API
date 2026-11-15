import { AppError } from '../utils/AppError.js';
import { validarId } from '../utils/validators.js';
import * as repo from '../repositories/usuarios_repositories.js';



export const validarNombre = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError(400, 'El nombre es obligatorio');
  }
  if (nombre.trim().length > 100) {
    throw new AppError(400, 'El nombre no puede superar 100 caracteres');
  }
  return nombre.trim();
};

export const validarEmail = (email) => {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new AppError(400, 'El correo es obligatorio');
  }

  const emailLimpio = email.trim().toLowerCase();

  if (emailLimpio.length > 150) {
    throw new AppError(400, 'El email no puede superar los 150 caracteres');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
    throw new AppError(400, 'El formato del email no es válido');
  }

  return emailLimpio;
};

export const listar = () => repo.listar();

export const obtener = async (id, user) => {
  const usuarioId = validarId(id);
  if (user.rol === 'lector' && usuarioId !== user.id) throw new AppError(403, 'Solo puedes ver tu propio usuario', 'PERMISO_DENEGADO');
  const usuario = await repo.buscarPorId(usuarioId);
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');
  return usuario;
};

export const actualizar = async (id, nombre, email, user) => {
  const usuarioId = validarId(id);
  if (user.rol !== 'admin' && usuarioId !== user.id) throw new AppError(403, 'Solo puedes modificar tu propio usuario', 'PERMISO_DENEGADO');
  const nombreLimpio = validarNombre(nombre);
  const emailLimpio = validarEmail(email);

  const usuario = await repo.actualizar(usuarioId, nombreLimpio, emailLimpio);
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');
  return usuario;
};

export const eliminar = async (id, user) => {
  const usuarioId = validarId(id);
  if (user.rol !== 'admin' && usuarioId !== user.id) throw new AppError(403, 'Solo puedes modificar tu propio usuario', 'PERMISO_DENEGADO');
  // si un admin no puede quitarse el rol ni borrarse, siempre queda al menos uno
  if (user.rol === 'admin' && usuarioId === user.id) throw new AppError(400, 'Un admin no puede borrarse a sí mismo; pídeselo a otro admin');
  const eliminado = await repo.eliminar(usuarioId);
  if (!eliminado) throw new AppError(404, 'Usuario no encontrado');
};

const ROLES = ['lector', 'bibliotecario', 'admin'];

export const cambiarRol = async (id,rol,user) => {
  const usuarioId = validarId(id);
  if(!ROLES.includes(rol)) throw new AppError(400, `El rol debe ser uno de: ${ROLES.join(', ')}`);
  //evita que el ultimo admin se quite el rol a si mismo
  if(usuarioId === user.id && rol !== 'admin') throw new AppError(400, 'No puedes quitarte el rol de admin a ti mismo');

  const usuario = await repo.cambiarRol(usuarioId,rol);
  if(!usuario) throw new AppError(404, 'Usuario no encontrado');
  return usuario;
}