import type { Request, Response } from 'express';
import * as service from '../services/auditoria_services.js';

export const listar = async (req: Request, res: Response): Promise<void> => {
    const { accion, actorId, cursor, limite } = req.query;
    res.json(await service.listar({ accion, actorId, cursor, limite }));
};
