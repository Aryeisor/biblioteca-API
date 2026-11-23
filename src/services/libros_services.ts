import * as repo from '../repositories/libros_repositories.js';
import * as autoresRepo from '../repositories/autores_repositories.js';
import { AppError } from '../utils/AppError.js';
import { validarId } from '../utils/validators.js';
import { paginarOffset, type ParametrosPagina } from '../utils/paginacion.js';
import type { DatosLibro } from '../types/dominio.js';

// Lo que llega en el body: puede ser cualquier cosa. validarLibro lo convierte en DatosLibro (ya verificado).
type EntradaLibro = { titulo?: unknown; isbn?: unknown; autorId?: unknown; stock?: unknown };

const validarLibro = ({ titulo, isbn, autorId, stock }: EntradaLibro): DatosLibro => {
    if (typeof titulo !== 'string' || titulo.trim() === '') {
        throw new AppError(400, 'El título es obligatorio');
    }
    if (titulo.trim().length > 200) {
        throw new AppError(400, 'El título no puede superar 200 caracteres');
    }

    let isbnLimpio: string | null = null;
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

const verificarAutor = async (autorId: number) => {
    const autor = await autoresRepo.buscarPorId(autorId);
    if (!autor) throw new AppError(404, 'El autor indicado no existe');
};

export const actualizarStock = async (id: unknown, stock: unknown) => {
    const libroId = validarId(id);
    if (stock === undefined || stock === null || stock === '')
        throw new AppError(400, 'El stock es obligatorio');

    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0)
        throw new AppError(400, 'El stock debe ser un entero mayor o igual a 0');

    const actualizado = await repo.actualizarStock(libroId, { stock: stockNum });
    if (!actualizado) throw new AppError(404, 'Libro no encontrado');

    return repo.buscarPorId(libroId);
};

type FiltroLibros = ParametrosPagina & { titulo?: unknown };

export const listar = ({ titulo, pagina, limite }: FiltroLibros = {}) => {
    // ?titulo=a&titulo=b llega como arreglo: antes hacía .trim() sobre él y respondía 500.
    // Con titulo: unknown TypeScript obliga a comprobar el tipo, y el bug sale a la luz.
    if (titulo !== undefined && typeof titulo !== 'string') {
        throw new AppError(400, 'El filtro titulo debe ser texto');
    }
    const filtro = typeof titulo === 'string' ? titulo.trim() || null : null;
    return paginarOffset({ pagina, limite }, (lim, offset) => repo.listar(filtro, lim, offset));
};

export const obtener = async (id: unknown) => {
    const libro = await repo.buscarPorId(validarId(id));
    if (!libro) throw new AppError(404, 'Libro no encontrado');
    return libro;
};

export const crear = async (datos: EntradaLibro) => {
    const libro = validarLibro(datos);
    await verificarAutor(libro.autorId);
    const { id } = await repo.crear(libro);
    return repo.buscarPorId(id);
};

export const actualizar = async (id: unknown, datos: EntradaLibro) => {
    const libroId = validarId(id);
    const libro = validarLibro(datos);
    await verificarAutor(libro.autorId);
    const actualizado = await repo.actualizar(libroId, libro);
    if (!actualizado) throw new AppError(404, 'Libro no encontrado');
    return repo.buscarPorId(libroId);
};

export const eliminar = async (id: unknown) => {
    const eliminado = await repo.eliminar(validarId(id));
    if (!eliminado) throw new AppError(404, 'Libro no encontrado');
};
