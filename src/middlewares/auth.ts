import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { esRol, type UsuarioAutenticado } from '../types/dominio.js';
import { AppError } from '../utils/AppError.js';

const PREFIJO = 'Bearer ';

const auth: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith(PREFIJO)) {
        return next(new AppError(401, 'Token requerido', 'TOKEN_REQUERIDO'));
    }
    const token = header.slice(PREFIJO.length);

    let payload: string | jwt.JwtPayload; // payload es lo que metiste al firmar: { sub, rol, iat, exp }
    try {
        payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return next(new AppError(401, 'El token expiró', 'TOKEN_EXPIRADO'));
        }
        return next(new AppError(401, 'Token inválido', 'TOKEN_INVALIDO'));
    }

    // verify() devuelve string | JwtPayload: un token firmado con un texto plano no trae campos
    if (typeof payload === 'string') {
        return next(new AppError(401, 'Token inválido', 'TOKEN_INVALIDO'));
    }
    // sub se firma como texto (RFC 7519); Number() acepta también los tokens antiguos con sub numérico
    const id = Number(payload.sub);
    // esRol: un rol que no exista (aunque el token esté bien firmado) tampoco entra
    if (!Number.isInteger(id) || id < 1 || !esRol(payload.rol)) {
        return next(new AppError(401, 'Token inválido', 'TOKEN_INVALIDO'));
    }
    req.user = { id, rol: payload.rol };
    next();
};

export default auth;

// Para los controladores de rutas protegidas: devuelve el usuario o falla cerrado (401).
// Evita escribir req.user! : si alguien olvida poner auth en una ruta, el resultado es un 401
// y no un acceso sin identidad.
export const usuarioActual = (req: Request): UsuarioAutenticado => {
    if (!req.user) throw new AppError(401, 'Token requerido', 'TOKEN_REQUERIDO');
    return req.user;
};
