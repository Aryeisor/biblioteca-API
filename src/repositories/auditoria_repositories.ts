import type { PoolClient } from 'pg';
import pool from '../config/db.js';
import type { EntradaAuditoria, EventoAuditoria } from '../types/dominio.js';

// Recibe el client: así un cambio y su registro de auditoría pueden ir en la MISMA transacción
export const insertar = async (client: PoolClient, evento: EventoAuditoria): Promise<void> => {
    await client.query(
        `INSERT INTO audit_log (accion, actor_id, objetivo_id, ip, request_id, detalle)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
            evento.accion,
            evento.actorId ?? null,
            evento.objetivoId ?? null,
            evento.contexto.ip,
            evento.contexto.requestId,
            JSON.stringify(evento.detalle ?? {}),
        ],
    );
};

// Pide limite + 1 filas (ver paginarPorCursor). Orden: del más reciente al más viejo.
export const listar = async (
    accion: string | null,
    actorId: number | null,
    cursorId: number | null,
    limite: number,
): Promise<EntradaAuditoria[]> => {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (accion !== null) {
        params.push(accion);
        condiciones.push(`accion = $${params.length}`);
    }
    if (actorId !== null) {
        params.push(actorId);
        condiciones.push(`actor_id = $${params.length}`);
    }
    if (cursorId !== null) {
        params.push(cursorId);
        condiciones.push(`id < $${params.length}`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    params.push(limite + 1);
    const { rows } = await pool.query<EntradaAuditoria>(
        `SELECT id, creado_en, accion, actor_id, objetivo_id, ip, request_id, detalle
         FROM audit_log ${where} ORDER BY id DESC LIMIT $${params.length}`,
        params,
    );
    return rows;
};
