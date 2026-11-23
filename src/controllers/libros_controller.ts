import type { Request, Response } from 'express';
import * as service from '../services/libros_services.js';

export const listar = async (req: Request, res: Response): Promise<void> => {
    const { titulo, pagina, limite } = req.query;
    res.json(await service.listar({ titulo, pagina, limite }));
};

export const obtenerPorId = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.obtener(req.params.id));
};

export const crear = async (req: Request, res: Response): Promise<void> => {
    const libro = await service.crear(req.body ?? {});
    res.status(201).json(libro);
};

export const actualizar = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.actualizar(req.params.id, req.body ?? {}));
};

export const actualizarStock = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.actualizarStock(req.params.id, req.body?.stock));
};

export const eliminar = async (req: Request, res: Response): Promise<void> => {
    await service.eliminar(req.params.id);
    res.status(204).send();
};
