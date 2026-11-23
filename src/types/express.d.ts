import type { UsuarioAutenticado } from './dominio.js';

// "Declaration merging": se le agrega el campo `user` al Request de Express.
// Es opcional (?) porque solo existe en las rutas que pasan antes por el middleware auth.
// Este archivo no genera JavaScript: solo le enseña el campo al compilador.
declare global {
    namespace Express {
        interface Request {
            user?: UsuarioAutenticado;
        }
    }
}
