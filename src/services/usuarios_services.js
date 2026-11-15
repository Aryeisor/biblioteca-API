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

export const obtener = async (id) => {
  const usuario = await repo.buscarPorId(validarId(id));
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');
  return usuario;
};

export const actualizar = async (id, nombre, email, userId) => {
  const usuarioId = validarId(id);
  if (usuarioId !== userId) throw new AppError(403, 'Solo puedes modificar tu propio usuario');
  const nombreLimpio = validarNombre(nombre);
  const emailLimpio = validarEmail(email);

  const usuario = await repo.actualizar(usuarioId, nombreLimpio, emailLimpio);
  if (!usuario) throw new AppError(404, 'Usuario no encontrado');
  return usuario;
};

export const eliminar = async (id, userId) => {
  const usuarioId = validarId(id);
  if (usuarioId !== userId) throw new AppError(403, 'Solo puedes modificar tu propio usuario');
  const eliminado = await repo.eliminar(usuarioId);
  if (!eliminado) throw new AppError(404, 'Usuario no encontrado');
};