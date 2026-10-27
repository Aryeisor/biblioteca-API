export default (err, req, res, next) => {
  if (err.code === '23503') {
    return res.status(409).json({
      message: 'No se puede completar: el registro está relacionado con otros datos',
    });
  }
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Ya existe un registro con ese valor' });
  }

  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
};