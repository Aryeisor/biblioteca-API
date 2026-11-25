import { z } from 'zod';
import { ACCIONES_AUDITORIA } from '../types/dominio.js';
import { esquemaEntero, esquemaId } from './comunes.js';

// Los filtros llegan como texto en la URL. optional(): si no vienen, no filtran.
export const esquemaFiltroAuditoria = z.object({
    accion: z
        .enum(ACCIONES_AUDITORIA, `accion debe ser una de: ${ACCIONES_AUDITORIA.join(', ')}`)
        .optional(),
    actorId: esquemaId('actorId').optional(),
    limite: esquemaEntero('limite', 1, 200, 50),
});
