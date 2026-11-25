import type { Request, Response } from 'express';
import * as service from '../services/usuarios_services.js';
import { usuarioActual } from '../middlewares/auth.js';
import { contextoDe } from '../utils/contexto.js';

export const listar = async (req: Request, res: Response): Promise<void> => {
    const { pagina, limite } = req.query;
    res.json(await service.listar({ pagina, limite }));
};

export const buscarPorId = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.obtener(req.params.id, usuarioActual(req)));
};

export const actualizar = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.actualizar(req.params.id, req.body, usuarioActual(req)));
};

export const eliminar = async (req: Request, res: Response): Promise<void> => {
    await service.eliminar(req.params.id, usuarioActual(req), contextoDe(req));
    res.status(204).send();
};

export const cambiarRol = async (req: Request, res: Response): Promise<void> => {
    res.json(
        await service.cambiarRol(req.params.id, req.body, usuarioActual(req), contextoDe(req)),
    );
};
