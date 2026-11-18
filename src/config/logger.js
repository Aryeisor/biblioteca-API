import pino from 'pino';
import { config } from './env.js';

// Sale en JSON (producción). En tu PC, `npm run dev` lo pasa por pino-pretty.
export const logger = pino({
    level: config.logLevel,
    redact: {
        // shortcut: redact no es recursivo, cubre password hasta 2 niveles; agregar rutas si se loguea algo más profundo
        paths: ['req.headers.authorization', 'password', '*.password', '*.*.password'],
        censor: '[OCULTO]',
    },
});
