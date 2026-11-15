import { AppError } from './AppError.js';

export const validarId = (id, nombre = 'ID') => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(400,`${nombre} inválido`);
  }
  return n;
};