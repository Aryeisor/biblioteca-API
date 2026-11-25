import { esquemaCursor } from '../schemas/comunes.js';
import { AppError } from './AppError.js';

// Cursor opaco: el cliente no ve un id sino {"id":N} en Base64url. Si mañana se ordena por fecha,
// se cambia lo que va dentro sin romper a nadie, porque ningún cliente armaba cursores a mano.
export const codificarCursor = (id: number): string =>
    Buffer.from(JSON.stringify({ id })).toString('base64url');

export const decodificarCursor = (cursor: unknown): number | null => {
    if (cursor === undefined) return null;
    try {
        if (typeof cursor !== 'string') throw new Error('el cursor no es texto');
        // JSON.parse devuelve any: el esquema comprueba que sea {id: entero >= 1}
        const { id } = esquemaCursor.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));
        return id;
    } catch {
        // cualquier fallo (no es Base64, no es JSON, id no válido) es el mismo error para el cliente
        throw new AppError(400, 'Cursor inválido', 'CURSOR_INVALIDO');
    }
};

// El repositorio pide limite + 1 filas: si llega la extra, hay otra página (sin hacer un COUNT).
// Las filas deben venir ordenadas por id descendente.
export const paginarPorCursor = <T extends { id: number }>(filas: T[], limite: number) => {
    const hayMas = filas.length > limite;
    const data = hayMas ? filas.slice(0, limite) : filas; // la fila extra solo avisa, no se devuelve
    // .at(-1) es "T | undefined": si hayMas, data nunca está vacío, pero TypeScript no lo sabe
    const ultima = data.at(-1);
    return {
        data,
        paginacion: {
            limite,
            siguienteCursor: hayMas && ultima ? codificarCursor(ultima.id) : null,
        },
    };
};
