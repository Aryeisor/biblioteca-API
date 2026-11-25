import { createHash } from 'node:crypto';
import pool from '../config/db.js';
import { logger } from '../config/logger.js';
import * as repo from '../repositories/auditoria_repositories.js';
import { parsear } from '../schemas/comunes.js';
import { esquemaFiltroAuditoria } from '../schemas/auditoria.js';
import { decodificarCursor, paginarPorCursor } from '../utils/cursor.js';
import type { EventoAuditoria } from '../types/dominio.js';

// Para correlacionar sin guardar el dato: los mismos 16 caracteres para el mismo texto, pero de ahí
// no se recupera el original. Sirve para un email intentado en un login fallido: no se guarda el
// correo (podría ser otra persona, o una contraseña escrita en el campo equivocado).
export const huellaCorta = (valor: string): string =>
    createHash('sha256').update(valor).digest('hex').slice(0, 16);

// Dentro de una transacción: si la acción falla, el registro también; y si el registro falla, la acción
// también. Para cambios sensibles (rol, borrado, revocación de sesiones): sin rastro no hay cambio.
export const registrarEn = repo.insertar;

// Fuera de transacción y "best effort": si la auditoría falla se deja constancia en el log, pero no se
// tumba la operación (un login no debe fallar porque la tabla de auditoría tenga un problema).
export const auditar = async (evento: EventoAuditoria): Promise<void> => {
    try {
        const client = await pool.connect();
        try {
            await repo.insertar(client, evento);
        } finally {
            client.release();
        }
    } catch (err) {
        logger.error({ err, accion: evento.accion }, 'no se pudo escribir en la auditoría');
    }
};

type FiltroListado = { accion?: unknown; actorId?: unknown; cursor?: unknown; limite?: unknown };

export const listar = async ({ accion, actorId, cursor, limite }: FiltroListado = {}) => {
    const filtro = parsear(esquemaFiltroAuditoria, { accion, actorId, limite });
    const cursorId = decodificarCursor(cursor);
    const filas = await repo.listar(
        filtro.accion ?? null,
        filtro.actorId ?? null,
        cursorId,
        filtro.limite,
    );
    return paginarPorCursor(filas, filtro.limite);
};
