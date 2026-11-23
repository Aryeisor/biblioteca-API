import type { Request, Response } from 'express';
import * as service from '../services/auth_services.js';

export const registrar = async (req: Request, res: Response): Promise<void> => {
    const { nombre, email, password } = req.body ?? {};
    const usuario = await service.registrar(nombre, email, password);
    res.status(201).json(usuario);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};
    res.json(await service.login(email, password));
};
