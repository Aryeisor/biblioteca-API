import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { PREFIJO_CLAVES, type AlmacenLimites, type ResultadoLimite } from '../limites/almacen.js';
import { crearAlmacenMemoria } from '../limites/almacenMemoria.js';

type OpcionesRateLimit = {
    ventanaMs: number;
    max: number;
    clave: (req: Request) => string; // ej.: req.ip, o el email del body
    code: string; // identifica al limitador: dos limitadores no comparten contador
};

// Si el almacén (Redis) tarda más que esto, se trata como caído: un login no puede esperar más.
const TIEMPO_MAXIMO_ALMACEN_MS = 500;

// Por defecto, memoria. server.ts cambia a Redis al arrancar si hay REDIS_URL.
let almacen: AlmacenLimites = crearAlmacenMemoria();

// Devuelve el almacén anterior para poder restaurarlo (los tests lo usan).
export const usarAlmacenLimites = (nuevo: AlmacenLimites): AlmacenLimites => {
    const anterior = almacen;
    almacen = nuevo;
    return anterior;
};

// Vacía los contadores del almacén actual (para los tests)
export const reiniciarLimites = (): Promise<void> => almacen.reiniciar();

// La clave se convierte en una huella: acota su tamaño (el email viene del body) y evita guardar
// emails de usuarios en Redis.
const huella = (valor: string): string => createHash('sha256').update(valor).digest('hex');

const conTope = async <T>(promesa: Promise<T>, ms: number): Promise<T> => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(
            () => rechazar(new Error(`el almacén no respondió en ${ms} ms`)),
            ms,
        );
    });
    try {
        return await Promise.race([promesa, tope]);
    } finally {
        clearTimeout(temporizador);
    }
};

export const rateLimit = ({ ventanaMs, max, clave, code }: OpcionesRateLimit): RequestHandler => {
    return async (req, res, next) => {
        const k = `${PREFIJO_CLAVES}${code}:${huella(clave(req))}`;

        let resultado: ResultadoLimite | undefined;
        try {
            resultado = await conTope(almacen.incrementar(k, ventanaMs), TIEMPO_MAXIMO_ALMACEN_MS);
        } catch (err) {
            // Decisión: si el almacén falla, se deja pasar ("fail open"). La alternativa (rechazar todo)
            // dejaría a TODOS sin poder entrar porque se cayó Redis; la protección contra fuerza bruta
            // se pierde mientras dure la caída, y por eso queda en el log como error.
            req.log.error(
                { err, code },
                'rate limiting: el almacén falló; se deja pasar la petición',
            );
        }

        if (resultado && resultado.cuenta > max) {
            const segundos = Math.max(1, Math.ceil(resultado.msRestantes / 1000));
            res.set('Retry-After', String(segundos));
            return next(new AppError(429, 'Demasiadas peticiones, intenta mas tarde', code));
        }
        next();
    };
};
