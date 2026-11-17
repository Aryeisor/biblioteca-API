import { AppError } from './AppError.js';

export const validarId = (id, nombre = 'ID') => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(400,`${nombre} inválido`);
  }
  return n;
};

// undefined → valor por defecto; cualquier otra cosa debe ser un entero dentro del rango.
export const validarEntero = (valor, nombre, min, max, porDefecto) => {
  if (valor === undefined) return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError(400, `${nombre} debe ser un entero entre ${min} y ${max}`);
  }
  return n;
};