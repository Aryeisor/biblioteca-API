import * as repo from '../repositories/libros_repositories.js';
import * as autoresRepo from '../repositories/autores_repositories.js';
import { AppError } from '../utils/AppError.js';
import { validarId, parsear } from '../schemas/comunes.js';
import { esquemaLibro, esquemaStockObligatorio, esquemaFiltroTitulo } from '../schemas/libros.js';
import { paginarOffset, type ParametrosPagina } from '../utils/paginacion.js';

const verificarAutor = async (autorId: number) => {
    const autor = await autoresRepo.buscarPorId(autorId);
    if (!autor) throw new AppError(404, 'El autor indicado no existe');
};

export const actualizarStock = async (id: unknown, stock: unknown) => {
    const libroId = validarId(id);
    const stockNum = parsear(esquemaStockObligatorio, stock);

    const actualizado = await repo.actualizarStock(libroId, { stock: stockNum });
    if (!actualizado) throw new AppError(404, 'Libro no encontrado');

    return repo.buscarPorId(libroId);
};

type FiltroLibros = ParametrosPagina & { titulo?: unknown };

export const listar = ({ titulo, pagina, limite }: FiltroLibros = {}) => {
    // ?titulo=a&titulo=b llega como arreglo: el esquema lo rechaza con 400 (antes respondía 500).
    const { titulo: tituloLimpio } = parsear(esquemaFiltroTitulo, { titulo });
    const filtro = tituloLimpio || null;
    return paginarOffset({ pagina, limite }, (lim, offset) => repo.listar(filtro, lim, offset));
};

export const obtener = async (id: unknown) => {
    const libro = await repo.buscarPorId(validarId(id));
    if (!libro) throw new AppError(404, 'Libro no encontrado');
    return libro;
};

export const crear = async (datos: unknown) => {
    const libro = parsear(esquemaLibro, datos);
    await verificarAutor(libro.autorId);
    const { id } = await repo.crear(libro);
    return repo.buscarPorId(id);
};

export const actualizar = async (id: unknown, datos: unknown) => {
    const libroId = validarId(id);
    const libro = parsear(esquemaLibro, datos);
    await verificarAutor(libro.autorId);
    const actualizado = await repo.actualizar(libroId, libro);
    if (!actualizado) throw new AppError(404, 'Libro no encontrado');
    return repo.buscarPorId(libroId);
};

export const eliminar = async (id: unknown) => {
    const eliminado = await repo.eliminar(validarId(id));
    if (!eliminado) throw new AppError(404, 'Libro no encontrado');
};
