import type { Request } from 'express';
import type { ContextoAuditoria } from '../types/dominio.js';

// De la petición solo se toma lo que la auditoría necesita: IP y X-Request-Id (que pino-http ya validó).
export const contextoDe = (req: Request): ContextoAuditoria => ({
    ip: req.ip ? req.ip.slice(0, 45) : null,
    requestId: req.id === undefined ? null : String(req.id).slice(0, 64),
});
