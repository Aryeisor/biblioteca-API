import type { RequestHandler } from 'express';
import type { Rol } from '../types/dominio.js';
import { AppError } from '../utils/AppError.js';

// Rol[]: authorize('bibliotecaro') (con la errata) ahora es un error al compilar, no un 403 misterioso
export const authorize = (...rolesPermitidos: Rol[]): RequestHandler => {
    return (req, _res, next) => {
        const rol = req.user?.rol;
        if (!rol || !rolesPermitidos.includes(rol)) {
            return next(
                new AppError(403, 'No tienes permiso para esta accion', 'PERMISO_DENEGADO'),
            );
        }
        next();
    };
};
