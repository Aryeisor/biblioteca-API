//Traduce HTTP a llamadas al service
//Express 5 pasa al errorHandler los errores de funciones async, por eso no hay try/catch

import type { Request, Response } from 'express';
import * as service from '../services/autores_services.js';

export const listar = async (_req: Request, res: Response): Promise<void> => {
    res.json(await service.listar());
};

export const obtener = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.obtener(req.params.id));
};

export const crear = async (req: Request, res: Response): Promise<void> => {
    const autor = await service.crear(req.body?.nombre);
    res.status(201).json(autor);
};

export const actualizar = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.actualizar(req.params.id, req.body?.nombre));
};

export const eliminar = async (req: Request, res: Response): Promise<void> => {
    await service.eliminar(req.params.id);
    res.status(204).send();
};
