import * as repo from '../repositories/libros_repositories.js';
import * as autoresRepo from '../repositories/autores_repositories.js';
import { AppError } from '../utils/AppError.js';
import { validarId } from '../utils/validators.js';



const validarLibro = ({ titulo, isbn, autorId, stock }) => {
  if (typeof titulo !== 'string' || titulo.trim() === '') {
    throw new AppError (400, 'El título es obligatorio');
  }
  if (titulo.trim().length > 200) {
    throw new AppError (400,'El título no puede superar 200 caracteres');
  }

  let isbnLimpio = null;
  if (isbn !== undefined && isbn !== null && isbn !== '') {
    if (typeof isbn !== 'string' || isbn.trim().length > 20) {
      throw new AppError(400, 'ISBN inválido (máximo 20 caracteres)');
    }
    isbnLimpio = isbn.trim();
  }

  const stockNum = stock === undefined ? 0 : Number(stock);
  if (!Number.isInteger(stockNum) || stockNum < 0) {
    throw new AppError(400, 'El stock debe ser un entero mayor o igual a 0');
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
  if (!autor) throw new AppError(404, 'El autor indicado no existe');
};

export const actualizarStock = async (id, stock) => {
  const libroId = validarId(id);
  if(stock === undefined || stock === null || stock === '') throw new AppError(400, 'El stock es obligatorio');

  const stockNum = Number(stock);
  if(!Number.isInteger(stockNum) || stockNum < 0) throw new AppError(400, 'El stock debe ser un entero mayor o igual a 0');

  const actualizado = await repo.actualizarStock(libroId, { stock: stockNum});
  if (!actualizado) throw new AppError(404, 'Libro no encontrado');

  return repo.buscarPorId(libroId);
};

// undefined → valor por defecto; cualquier otra cosa debe ser un entero dentro del rango.
const validarEntero = (valor, nombre, min, max, porDefecto) => {
  if (valor === undefined) return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError(400, `${nombre} debe ser un entero entre ${min} y ${max}`);
  }
  return n;
};

export const listar = async ({ titulo, pagina, limite } = {}) => {
  const filtro = titulo?.trim() || null;
  const paginaNum = validarEntero(pagina, 'pagina', 1, Number.MAX_SAFE_INTEGER, 1);
  const limiteNum = validarEntero(limite, 'limite', 1, 100, 20); // 400 en vez de recortar: el cliente se entera del error
  const offset = (paginaNum - 1) * limiteNum;

  const filas = await repo.listar(filtro, limiteNum, offset);

  // Página vacía: el total viaja dentro de las filas, así que si no hay filas hay que pedirlo aparte.
  let total = filas.length ? Number(filas[0].total) : 0;
  if (!filas.length && offset > 0) {
    const [primera] = await repo.listar(filtro, 1, 0);
    total = primera ? Number(primera.total) : 0;
  }

  return {
    data: filas.map(({ total, ...libro }) => libro),
    paginacion: {
      pagina: paginaNum,
      limite: limiteNum,
      total,
      totalPaginas: Math.ceil(total / limiteNum),
    },
  };
};

export const obtener = async (id) => {
  const libro = await repo.buscarPorId(validarId(id));
  if (!libro) throw new AppError(404, 'Libro no encontrado');
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
  if (!actualizado) throw new AppError(404, 'Libro no encontrado');
  return repo.buscarPorId(libroId);
};

export const eliminar = async (id) => {
  const eliminado = await repo.eliminar(validarId(id));
  if (!eliminado) throw new AppError(404, 'Libro no encontrado');
};