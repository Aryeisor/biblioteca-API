import { AppError } from "../utils/AppError.js";

// 4 parámetros obligatorios: así Express sabe que es un manejador de errores (_next no se usa)
export default (err, req, res, _next) => {
  if (err.code === '23503') {
    return res.status(409).json({code: 'REGISTRO_RELACIONADO',
      message: 'No se puede completar: el registro está relacionado con otros datos',
    });
  }
  // antes del 23505 genérico: err.constraint dice qué índice único se violó
  if (err.code === '23505' && err.constraint === 'uq_prestamo_activo') {
    return res.status(409).json({code: 'PRESTAMO_DUPLICADO', message: 'Ya tienes este libro prestado' });
  }
  if (err.code === '23505') {
    return res.status(409).json({code: 'REGISTRO_DUPLICADO', message: 'Ya existe un registro con ese valor' });
  }

  if (err.type === 'entity.parse.failed'){
    return res.status(400).json({code: 'JSON_INVALIDO', message: 'El cuerpo de la petición no es un JSON válido'})
  }

  if (err.expose && err.status){
    return res.status(err.status).json({code: 'PETICION_INVALIDA', message:err.message});
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({code: err.code, message: err.message});
  }

  req.log.error({ err }, 'error no controlado');
  // requestId: el cliente lo reporta y lo buscamos en los logs, sin exponerle el error real
  res.status(500).json({ code: 'ERROR_INTERNO', message: 'Error interno del servidor', requestId: req.id });
};