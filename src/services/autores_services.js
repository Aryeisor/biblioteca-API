//Reglas de negocio y validaciones. No conoce req, res ni SQL

import * as repo from '../repositories/autores_repositories.js';
import { AppError } from '../utils/AppError.js';
import { validarId } from '../utils/validators.js';

const validarNombre = (nombre) => {
    if (typeof nombre !== 'string' || nombre.trim() === '') {
        throw new AppError(400, 'El nombre es obligatorio');
    }
    if (nombre.trim().length > 100) {
        throw new AppError(400, 'El nombre no puede superar 100 caracteres');
    }
    return nombre.trim();
};

export const listar = () => repo.listar();

export const obtener = async (id) => {
    const autor = await repo.buscarPorId(validarId(id));
    if (!autor) throw new AppError(404, 'Autor no encontrado');
    return autor;
};

export const crear = (nombre) => repo.crear(validarNombre(nombre));

export const actualizar = async (id, nombre) => {
    const autor = await repo.actualizar(validarId(id), validarNombre(nombre));
    if (!autor) throw new AppError(404, 'Autor no encontrado');
    return autor;
};

export const eliminar = async (id) => {
    const eliminado = await repo.eliminar(validarId(id));
    if (!eliminado) throw new AppError(404, 'Autor no encontrado');
};
