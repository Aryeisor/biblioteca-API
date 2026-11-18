import { AppError } from '../utils/AppError.js';

// Todos los Map de todos los limitadores, para poder vaciarlos en los tests
const todosLosRegistros = new Set();
export const reiniciarLimites = () => todosLosRegistros.forEach((m) => m.clear());

// shortcut: Map en memoria de un solo proceso; con varias instancias pasar a Redis
export const rateLimit = ({ ventanaMs, max, clave, code }) => {
    const registros = new Map(); // clave → { cuenta, reiniciaEn }
    todosLosRegistros.add(registros);

    const limpieza = setInterval(() => {
        const ahora = Date.now();
        for (const [k, registro] of registros) {
            if (ahora >= registro.reiniciaEn) registros.delete(k);
        }
    }, ventanaMs);
    limpieza.unref();

    return (req, res, next) => {
        const k = clave(req); // ej.: req.ip, o el email del body
        const ahora = Date.now();
        let registro = registros.get(k);
        if (!registro || ahora >= registro.reiniciaEn) {
            registro = { cuenta: 0, reiniciaEn: ahora + ventanaMs };
            registros.set(k, registro);
        }

        registro.cuenta++;

        if (registro.cuenta > max) {
            const segundos = Math.ceil((registro.reiniciaEn - ahora) / 1000);
            res.set('Retry-After', String(segundos));
            return next(new AppError(429, 'Demasiadas peticiones, intenta mas tarde', code));
        }
        next();
    };
};
