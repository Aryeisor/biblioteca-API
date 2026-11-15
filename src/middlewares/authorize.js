import { AppError } from "../utils/AppError.js";

export const authorize = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!rolesPermitidos.includes(req.user?.rol)){
            return next  (new AppError(403, 'No tienes permiso para esta accion', 'PERMISO_DENEGADO'));
        }
        next();
    };
};


