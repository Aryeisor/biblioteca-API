import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

// Los errores de pg y de body-parser son objetos con campos propios (code, constraint, type...).
// Se leen como "unknown" y se comprueba cada valor: nada de any.
const leer = (err: unknown, campo: string): unknown =>
    typeof err === 'object' && err !== null ? (err as Record<string, unknown>)[campo] : undefined;

// 4 parámetros obligatorios: así Express sabe que es un manejador de errores (_next no se usa)
const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
    const codigo = leer(err, 'code');

    // 23503: foreign_key_violation; 23001: restrict_violation (FK con ON DELETE/UPDATE RESTRICT)
    if (codigo === '23503' || codigo === '23001') {
        res.status(409).json({
            code: 'REGISTRO_RELACIONADO',
            message: 'No se puede completar: el registro está relacionado con otros datos',
        });
        return;
    }
    // antes del 23505 genérico: err.constraint dice qué índice único se violó
    if (codigo === '23505' && leer(err, 'constraint') === 'uq_prestamo_activo') {
        res.status(409).json({
            code: 'PRESTAMO_DUPLICADO',
            message: 'Ya tienes este libro prestado',
        });
        return;
    }
    if (codigo === '23505') {
        res.status(409).json({
            code: 'REGISTRO_DUPLICADO',
            message: 'Ya existe un registro con ese valor',
        });
        return;
    }

    if (leer(err, 'type') === 'entity.parse.failed') {
        res.status(400).json({
            code: 'JSON_INVALIDO',
            message: 'El cuerpo de la petición no es un JSON válido',
        });
        return;
    }

    const status = leer(err, 'status');
    if (leer(err, 'expose') === true && typeof status === 'number') {
        res.status(status).json({
            code: 'PETICION_INVALIDA',
            message: err instanceof Error ? err.message : 'Petición inválida',
        });
        return;
    }

    if (err instanceof AppError) {
        res.status(err.status).json({ code: err.code, message: err.message });
        return;
    }

    req.log.error({ err }, 'error no controlado');
    // requestId: el cliente lo reporta y lo buscamos en los logs, sin exponerle el error real
    res.status(500).json({
        code: 'ERROR_INTERNO',
        message: 'Error interno del servidor',
        requestId: req.id,
    });
};

export default errorHandler;
