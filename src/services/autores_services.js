//Reglas de negocio y validaciones. No conoce req, res ni SQL

import * as repo from '../repositories/autores_repositories.js';

const validarId = (id) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw { status: 400, message: 'ID inválido' };
  }
  return n;
};

const validarNombre = (nombre) => {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw { status: 400, message: 'El nombre es obligatorio' };
  }
  if (nombre.trim().length > 100) {
    throw { status: 400, message: 'El nombre no puede superar 100 caracteres' };
  }
  return nombre.trim();
};

export const listar = () => repo.listar();

export const obtener = async (id) => {
  const autor = await repo.buscarPorId(validarId(id));
  if (!autor) throw { status: 404, message: 'Autor no encontrado' };
  return autor;
};

export const crear = (nombre) => repo.crear(validarNombre(nombre));

export const actualizar = async (id, nombre) => {
  const autor = await repo.actualizar(validarId(id), validarNombre(nombre));
  if (!autor) throw { status: 404, message: 'Autor no encontrado' };
  return autor;
};

export const eliminar = async (id) => {
  const eliminado = await repo.eliminar(validarId(id));
  if (!eliminado) throw { status: 404, message: 'Autor no encontrado' };
};