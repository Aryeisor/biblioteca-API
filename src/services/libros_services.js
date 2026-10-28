import * as repo from '../repositories/libros_repositories.js';
import * as autoresRepo from '../repositories/autores_repositories.js';

const validarId = (id, nombre = 'ID') => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw { status: 400, message: `${nombre} inválido` };
  }
  return n;
};

const validarLibro = ({ titulo, isbn, autorId, stock }) => {
  if (typeof titulo !== 'string' || titulo.trim() === '') {
    throw { status: 400, message: 'El título es obligatorio' };
  }
  if (titulo.trim().length > 200) {
    throw { status: 400, message: 'El título no puede superar 200 caracteres' };
  }

  let isbnLimpio = null;
  if (isbn !== undefined && isbn !== null && isbn !== '') {
    if (typeof isbn !== 'string' || isbn.trim().length > 20) {
      throw { status: 400, message: 'ISBN inválido (máximo 20 caracteres)' };
    }
    isbnLimpio = isbn.trim();
  }

  const stockNum = stock === undefined ? 0 : Number(stock);
  if (!Number.isInteger(stockNum) || stockNum < 0) {
    throw { status: 400, message: 'El stock debe ser un entero mayor o igual a 0' };
  }

  return {
    titulo: titulo.trim(),
    isbn: isbnLimpio,
    autorId: validarId(autorId, 'autorId'),
    stock: stockNum,
  };
};

const verificarAutor = async (autorId) => {
  const autor = await autoresRepo.buscarPorId(autorId);
  if (!autor) throw { status: 404, message: 'El autor indicado no existe' };
};

export const listar = (titulo) => repo.listar(titulo?.trim() || null);

export const obtener = async (id) => {
  const libro = await repo.buscarPorId(validarId(id));
  if (!libro) throw { status: 404, message: 'Libro no encontrado' };
  return libro;
};

export const crear = async (datos) => {
  const libro = validarLibro(datos);
  await verificarAutor(libro.autorId);
  const { id } = await repo.crear(libro);
  return repo.buscarPorId(id);
};

export const actualizar = async (id, datos) => {
  const libroId = validarId(id);
  const libro = validarLibro(datos);
  await verificarAutor(libro.autorId);
  const actualizado = await repo.actualizar(libroId, libro);
  if (!actualizado) throw { status: 404, message: 'Libro no encontrado' };
  return repo.buscarPorId(libroId);
};

export const eliminar = async (id) => {
  const eliminado = await repo.eliminar(validarId(id));
  if (!eliminado) throw { status: 404, message: 'Libro no encontrado' };
};