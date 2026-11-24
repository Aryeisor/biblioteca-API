import { createClient } from 'redis';
import { config } from './env.js';
import { logger } from './logger.js';

const TIEMPO_CONEXION_MS = 5_000;

// Se crea con una función (en vez de llamar a createClient directamente) para que ClienteRedis
// infiera el mismo tipo que usa conectarRedis; createClient() sin args infiere un tipo distinto.
const crearCliente = (url: string) =>
    createClient({
        url,
        socket: { connectTimeout: TIEMPO_CONEXION_MS },
        // Si Redis no está disponible, los comandos fallan al instante en vez de quedarse en cola
        // esperando: así el rate limiting decide enseguida (ver rateLimit.ts) y no cuelga los logins.
        disableOfflineQueue: true,
    });

export type ClienteRedis = ReturnType<typeof crearCliente>;

let cliente: ClienteRedis | undefined;

// Conecta una sola vez. Devuelve undefined si no hay REDIS_URL (se usa el almacén en memoria).
export const conectarRedis = async (): Promise<ClienteRedis | undefined> => {
    if (!config.redisUrl) return undefined;
    if (cliente) return cliente;

    const nuevo = crearCliente(config.redisUrl);

    // Sin este listener, un error de conexión sin manejar tumbaría todo el proceso.
    // El cliente reintenta solo; aquí solo se registra.
    nuevo.on('error', (err) => logger.error({ err }, 'error de conexión con Redis'));

    // connect() reintenta sin fin si Redis no responde: se pone un tope para fallar al arrancar.
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const tope = new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(
            () => rechazar(new Error(`Redis no respondió en ${TIEMPO_CONEXION_MS} ms`)),
            TIEMPO_CONEXION_MS,
        );
    });
    try {
        await Promise.race([nuevo.connect(), tope]);
    } catch (error) {
        nuevo.destroy();
        throw error;
    } finally {
        clearTimeout(temporizador);
    }

    cliente = nuevo;
    return nuevo;
};

// Cierre ordenado: termina los comandos pendientes; si falla, corta la conexión.
export const cerrarRedis = async (): Promise<void> => {
    if (!cliente) return;
    const actual = cliente;
    cliente = undefined;
    try {
        await actual.close();
    } catch {
        actual.destroy();
    }
};
