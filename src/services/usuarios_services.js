import * as repo from '../repositories/usuarios_repositories.js';


const validarId = (id) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw { status: 400, message: 'ID inválido' };
  }
  return n;
};

export const validarNombre = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw { status: 400, message: 'El nombre es obligatorio' };
  }
  if (nombre.trim().length > 100) {
    throw { status: 400, message: 'El nombre no puede superar 100 caracteres' };
  }
  return nombre.trim();
};

export const validarEmail = (email) => {
  if (typeof email !== 'string' || email.trim() === '') {
    throw { status: 400, message: 'El correo es obligatorio' };
  }

  const emailLimpio = email.trim().toLowerCase();

  if (emailLimpio.length > 150) {
    throw { status: 400, message: 'El email no puede superar los 150 caracteres' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
    throw { status: 400, message: 'El formato del email no es válido' };
  }

  return emailLimpio;
};

export const listar = () => repo.listar();

export const obtener = async (id) => {
  const usuario = await repo.buscarPorId(validarId(id));
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  return usuario;
};

export const actualizar = async (id, nombre, email, userId) => {
  const usuarioId = validarId(id);
  if (usuarioId !== userId) throw { status: 403, message: 'Solo puedes modificar tu propio usuario' };
  const nombreLimpio = validarNombre(nombre);
  const emailLimpio = validarEmail(email);

  const usuario = await repo.actualizar(usuarioId, nombreLimpio, emailLimpio);
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  return usuario;
};

export const eliminar = async (id, userId) => {
  const usuarioId = validarId(id);
  if (usuarioId !== userId) throw { status: 403, message: 'Solo puedes modificar tu propio usuario' };
  const eliminado = await repo.eliminar(usuarioId);
  if (!eliminado) throw { status: 404, message: 'Usuario no encontrado' };
};