import { AppError } from './AppError.js';

// unknown (no any): el id viene de afuera (req.params, req.body) y no sabemos qué es.
// Con unknown TypeScript obliga a comprobarlo antes de usarlo; con any se desactivaría la revisión.
export const validarId = (id: unknown, nombre = 'ID'): number => {
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) {
        throw new AppError(400, `${nombre} inválido`);
    }
    return n;
};

// undefined → valor por defecto; cualquier otra cosa debe ser un entero dentro del rango.
export const validarEntero = (
    valor: unknown,
    nombre: string,
    min: number,
    max: number,
    porDefecto: number,
): number => {
    if (valor === undefined) return porDefecto;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < min || n > max) {
        throw new AppError(400, `${nombre} debe ser un entero entre ${min} y ${max}`);
    }
    return n;
};
