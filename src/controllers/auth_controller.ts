import type { Request, Response } from 'express';
import * as service from '../services/auth_services.js';

export const registrar = async (req: Request, res: Response): Promise<void> => {
    const usuario = await service.registrar(req.body);
    res.status(201).json(usuario);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    res.json(await service.login(req.body));
};
