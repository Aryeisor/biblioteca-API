import { z } from 'zod';
import { esquemaEntero, esquemaId } from './comunes.js';

// Lo que va DENTRO del cursor opaco: {"id": N}
export const esquemaCursor = z.object({ id: esquemaId('id') });

export const esquemaLimitePrestamos = esquemaEntero('limite', 1, 100, 20);
