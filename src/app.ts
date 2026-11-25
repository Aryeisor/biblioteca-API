import { randomUUID } from 'node:crypto';
import express, { type Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './config/logger.js';
import autoresRoutes from './routes/autores.router.js';
import librosRoutes from './routes/libros.router.js';
import usuariosRoutes from './routes/usuarios.router.js';
import prestamosRoutes from './routes/prestamos.router.js';
import authRoutes from './routes/auth.router.js';
import healthRoutes from './routes/health.router.js';
import errorHandler from './middlewares/errorHandler.js';
import { config } from './config/env.js';

const app = express();

// Nunca 'true': le creería a cualquier X-Forwarded-For que invente el cliente
app.set('trust proxy', config.trustProxy);

// El X-Request-Id viene del cliente: solo se reutiliza si es corto y sin caracteres raros (evita inyectar basura en los logs)
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{1,64}$/;

app.use(
    pinoHttp({
        logger,
        // Docker consulta /health cada 10 s: sin esto serían ~8.640 líneas al día que no dicen nada.
        // Solo se omite la línea automática; los errores de /health/ready se siguen registrando con req.log
        autoLogging: {
            // pino-http tipa req como IncomingMessage, que no tiene originalUrl (lo agrega Express).
            // Se usa originalUrl y no url porque Express recorta url al entrar a un router montado.
            ignore: (req) =>
                /^\/health(\/|\?|$)/.test((req as Request).originalUrl ?? req.url ?? ''),
        },
        genReqId: (req, res) => {
            const entrante = req.headers['x-request-id'];
            // typeof primero: test(undefined) convierte a "undefined" y pasaría la regex
            const id =
                typeof entrante === 'string' && REQUEST_ID_VALIDO.test(entrante)
                    ? entrante
                    : randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
        },
    }),
);
app.use(helmet());
// credentials: el navegador solo envía la cookie del refresh token si la API lo permite explícitamente.
// Con credentials no vale '*': por eso CORS_ORIGINS es una lista cerrada de orígenes.
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/autores', autoresRoutes);
app.use('/libros', librosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/prestamos', prestamosRoutes);
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);

app.use((_req, res) => {
    res.status(404).json({ code: 'RUTA_NO_ENCONTRADA', message: 'Ruta no encontrada' });
});
app.use(errorHandler);

export default app;
