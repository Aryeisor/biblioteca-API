//Reglas de negocio y validaciones. No conoce req, res ni SQL

import * as repo from '../repositories/autores_repositories.js';
import { AppError } from '../utils/AppError.js';
import { validarId, parsear } from '../schemas/comunes.js';
import { esquemaNombreAutor } from '../schemas/autores.js';

export const listar = () => repo.listar();

export const obtener = async (id: unknown) => {
    const autor = await repo.buscarPorId(validarId(id));
    if (!autor) throw new AppError(404, 'Autor no encontrado');
    return autor;
};

export const crear = (nombre: unknown) => repo.crear(parsear(esquemaNombreAutor, nombre));

export const actualizar = async (id: unknown, nombre: unknown) => {
    const autor = await repo.actualizar(validarId(id), parsear(esquemaNombreAutor, nombre));
    if (!autor) throw new AppError(404, 'Autor no encontrado');
    return autor;
};

export const eliminar = async (id: unknown) => {
    const eliminado = await repo.eliminar(validarId(id));
    if (!eliminado) throw new AppError(404, 'Autor no encontrado');
};
