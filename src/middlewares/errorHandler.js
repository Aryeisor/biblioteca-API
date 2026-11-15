import { AppError } from "../utils/AppError.js";

export default (err, req, res, next) => {
  if (err.code === '23503') {
    return res.status(409).json({code: 'REGISTRO_RELACIONADO',
      message: 'No se puede completar: el registro está relacionado con otros datos',
    });
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

  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
};