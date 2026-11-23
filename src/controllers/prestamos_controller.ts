import type { Request, Response } from 'express';
import * as service from '../services/prestamos_services.js';
import { usuarioActual } from '../middlewares/auth.js';

//req.query trae lo que va después del ? en la URL.
export const listar = async (req: Request, res: Response): Promise<void> => {
    const { activos, cursor, limite } = req.query;
    res.json(await service.listar({ activos, cursor, limite }, usuarioActual(req)));
};

export const prestar = async (req: Request, res: Response): Promise<void> => {
    const prestamo = await service.prestar(
        req.body?.libroId,
        req.body?.usuarioId,
        usuarioActual(req),
    );
    res.status(201).json(prestamo);
};

export const devolver = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.devolver(req.params.id));
};

export const obtener = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.obtener(req.params.id, usuarioActual(req)));
};
