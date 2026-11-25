import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

// Un esquema describe la forma que debe tener un dato. parsear() lo aplica y traduce el fallo
// al formato que ya usa la API: AppError 400 con un mensaje legible (el del primer problema).
// Devuelve z.output<S>: el tipo YA validado y transformado (trim, coerción, valores por defecto...).
export const parsear = <S extends z.ZodType>(esquema: S, entrada: unknown): z.output<S> => {
    const resultado = esquema.safeParse(entrada);
    if (!resultado.success) {
        throw new AppError(400, resultado.error.issues[0]?.message ?? 'Datos inválidos');
    }
    return resultado.data;
};

// Mensaje cuando el body no es un objeto (no llegó, o llegó un arreglo)
export const ERROR_CUERPO = { error: 'El cuerpo de la petición debe ser un objeto JSON' };

// Entero positivo. coerce: los ids llegan como texto en la URL ("5"), Zod los convierte con Number().
export const esquemaId = (nombre = 'ID') =>
    z.coerce.number(`${nombre} inválido`).int(`${nombre} inválido`).min(1, `${nombre} inválido`);

// Lo que va DENTRO del cursor opaco: {"id": N}
export const esquemaCursor = z.object({ id: esquemaId('id') });

// Misma firma que tenía en utils/validators.ts, pero con Zod por dentro.
export const validarId = (id: unknown, nombre = 'ID'): number => parsear(esquemaId(nombre), id);

// Entero dentro de un rango; si no viene (undefined) usa el valor por defecto.
export const esquemaEntero = (nombre: string, min: number, max: number, porDefecto: number) => {
    const mensaje = `${nombre} debe ser un entero entre ${min} y ${max}`;
    return z.coerce
        .number(mensaje)
        .int(mensaje)
        .min(min, mensaje)
        .max(max, mensaje)
        .default(porDefecto);
};

// Paginación por offset (libros y usuarios). 400 en vez de recortar: el cliente se entera del error.
export const esquemaPagina = z.object(
    {
        pagina: esquemaEntero('pagina', 1, Number.MAX_SAFE_INTEGER, 1),
        limite: esquemaEntero('limite', 1, 100, 20),
    },
    ERROR_CUERPO,
);

// Texto obligatorio: se recorta (trim) y se valida DESPUÉS de recortar, como antes.
export const textoObligatorio = (obligatorio: string, max: number, excede: string) =>
    z.string(obligatorio).trim().min(1, obligatorio).max(max, excede);
