import type { CookieOptions, Request, Response } from 'express';
import { config } from '../config/env.js';
import * as service from '../services/auth_services.js';
import * as sesiones from '../services/sesiones_services.js';
import { usuarioActual } from '../middlewares/auth.js';
import { AppError } from '../utils/AppError.js';
import { leerCookie } from '../utils/cookies.js';

const COOKIE_REFRESH = 'refresh_token';

// httpOnly: JavaScript de la página no puede leerla (un XSS no se la lleva).
// sameSite strict + path /auth: el navegador solo la envía a /auth/* y desde el mismo sitio (frena CSRF).
// secure: solo por HTTPS. req.secure es true tras un proxy HTTPS si TRUST_PROXY está bien configurado.
const opcionesCookie = (req: Request): CookieOptions => ({
    httpOnly: true,
    secure: req.secure,
    sameSite: 'strict',
    path: '/auth',
});

const guardarCookie = (req: Request, res: Response, refreshToken: string): void => {
    res.cookie(COOKIE_REFRESH, refreshToken, {
        ...opcionesCookie(req),
        maxAge: config.refreshTokenDias * 24 * 60 * 60 * 1000,
    });
};

export const registrar = async (req: Request, res: Response): Promise<void> => {
    const usuario = await service.registrar(req.body);
    res.status(201).json(usuario);
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { token, refreshToken } = await service.login(req.body);
    guardarCookie(req, res, refreshToken);
    res.json({ token });
};

export const refrescar = async (req: Request, res: Response): Promise<void> => {
    try {
        const { accessToken, refreshToken } = await sesiones.refrescar(
            leerCookie(req, COOKIE_REFRESH),
        );
        guardarCookie(req, res, refreshToken);
        res.json({ token: accessToken });
    } catch (err) {
        // Sesión inválida: se borra la cookie para que el navegador no la siga enviando.
        // En REFRESH_EN_CURSO no: la otra petición acaba de guardar la cookie nueva y esta la pisaría.
        if (err instanceof AppError && err.code === 'SESION_INVALIDA') {
            res.clearCookie(COOKIE_REFRESH, opcionesCookie(req));
        }
        throw err;
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    await sesiones.cerrarSesion(leerCookie(req, COOKIE_REFRESH));
    res.clearCookie(COOKIE_REFRESH, opcionesCookie(req));
    res.status(204).end();
};

export const logoutTodo = async (req: Request, res: Response): Promise<void> => {
    await sesiones.cerrarTodasLasSesiones(usuarioActual(req).id);
    res.clearCookie(COOKIE_REFRESH, opcionesCookie(req));
    res.status(204).end();
};
