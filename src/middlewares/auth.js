import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export default (req, res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return next(new AppError(401, 'Token requerido', 'TOKEN_REQUERIDO'));
    }
    const token = header.split(' ')[1];

    let payload; // payload es lo que metiste al firmar: { sub, rol iat, exp }
    try {
        payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError(401, 'El token expiró', 'TOKEN_EXPIRADO'));
        }
        return next(new AppError(401, 'Token inválido', 'TOKEN_INVALIDO'));
    }
    if (!payload.sub || !payload.rol) {
        return next(new AppError(401, 'Token inválido', 'TOKEN_INVALIDO'));
    }
    req.user = { id: payload.sub, rol: payload.rol };
    next();
};
