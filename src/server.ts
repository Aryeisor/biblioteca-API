import app from './app.js';
import pool from './config/db.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { estaApagando, marcarApagando } from './config/estado.js';
import { conectarRedis, cerrarRedis } from './config/redis.js';
import { usarAlmacenLimites } from './middlewares/rateLimit.js';
import { crearAlmacenRedis } from './limites/almacenRedis.js';

const PORT = config.port;
// Si las peticiones en curso no terminan en este tiempo, se fuerza la salida
const TIEMPO_MAXIMO_APAGADO_MS = 10_000;

// Comprobar la base antes de abrir el puerto: sin base, la API no sirve y es mejor no arrancar
try {
    await pool.query('SELECT 1');
    logger.info('conectado a la base de datos');
} catch (error) {
    logger.fatal({ err: error }, 'no se pudo conectar a la base de datos');
    process.exit(1);
}

// Redis guarda los contadores del rate limiting: así todas las instancias comparten el mismo límite.
// Sin REDIS_URL se queda el almacén en memoria (solo correcto con una instancia).
try {
    const redis = await conectarRedis();
    if (redis) {
        usarAlmacenLimites(crearAlmacenRedis(redis));
        logger.info('rate limiting: contadores en Redis');
    } else {
        logger.warn(
            'REDIS_URL no definida: el rate limiting usa memoria (válido con una sola instancia)',
        );
    }
} catch (error) {
    logger.fatal({ err: error }, 'no se pudo conectar a Redis');
    process.exit(1);
}

const server = app.listen(PORT, () => {
    logger.info(`escuchando en el puerto ${PORT}`);
});

const apagar = (señal: string): void => {
    // Una segunda señal (ej. Ctrl+C dos veces) no repite el apagado
    if (estaApagando()) return;

    // 1. /health/ready empieza a responder 503
    marcarApagando();
    logger.info({ señal }, 'señal recibida: iniciando apagado');

    // Seguro: si algo se cuelga, salir igual. unref() evita que este temporizador mantenga vivo el proceso
    setTimeout(() => {
        logger.fatal(`apagado forzado: no terminó en ${TIEMPO_MAXIMO_APAGADO_MS} ms`);
        process.exit(1);
    }, TIEMPO_MAXIMO_APAGADO_MS).unref();

    // 2. Dejar de aceptar conexiones nuevas y esperar a que terminen las peticiones en curso
    server.close(async (err) => {
        if (err) {
            logger.error({ err }, 'error al cerrar el servidor HTTP');
            process.exit(1);
        }
        logger.info('servidor HTTP cerrado: no quedan peticiones en curso');

        // 3. Cerrar Redis y el pool de la base (después del servidor: las últimas peticiones aún los usan)
        await cerrarRedis();
        try {
            await pool.end();
            logger.info('pool de la base de datos cerrado');
        } catch (error) {
            logger.error({ err: error }, 'error al cerrar el pool de la base de datos');
            process.exit(1);
        }

        logger.info('apagado completo');
        process.exit(0);
    });
    // server.close() espera también a las conexiones keep-alive inactivas: cerrarlas ya (las que tienen una petición en curso terminan)
    server.closeIdleConnections();
};

process.on('SIGTERM', () => apagar('SIGTERM')); // lo que envía Docker en `docker stop`
process.on('SIGINT', () => apagar('SIGINT')); // Ctrl+C en tu terminal
