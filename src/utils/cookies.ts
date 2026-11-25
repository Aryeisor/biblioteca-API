import type { Request } from 'express';

// Express no lee cookies por sí solo (haría falta cookie-parser). Para una sola cookie basta esto.
export const leerCookie = (req: Request, nombre: string): string | undefined => {
    const cabecera = req.headers.cookie;
    if (!cabecera) return undefined;
    for (const par of cabecera.split(';')) {
        const igual = par.indexOf('=');
        if (igual === -1) continue;
        if (par.slice(0, igual).trim() === nombre) return par.slice(igual + 1).trim();
    }
    return undefined;
};
