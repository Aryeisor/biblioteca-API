// src/config/env.js
import 'dotenv/config';
import pino from 'pino';

// No se puede usar logger.js: él importa este archivo para leer LOG_LEVEL (import circular).
// Logger mínimo solo para los errores de arranque; fatal siempre se muestra.
const log = pino();

// 1. Lista de variables OBLIGATORIA
const requeridas = [
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
];

// 2. Revisar cuáles faltan
const faltantes = requeridas.filter((nombre) => !process.env[nombre]);

if (faltantes.length > 0) {
    log.fatal(`Faltan variables de entorno: ${faltantes.join(', ')}`);
    process.exit(1);
}
//validar que el puerto sea un numero entre 1 y 65535
const validarPort = (valor, nombre) => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        log.fatal(`${nombre} invalido: ${valor} (debe ser un entero entre 1 y 65535)`);
        process.exit(1);
    }
    return n;
};

// TRUST_PROXY es opcional: sin proxy (tu PC) lo seguro es 0
const validarTrustProxy = (valor = '0') => {
    const n = Number(valor);
    if (valor.trim() === '' || !Number.isInteger(n) || n < 0) {
        log.fatal(`TRUST_PROXY invalido: "${valor}" (debe ser un entero >= 0)`);
        process.exit(1);
    }
    return n;
};

if (process.env.JWT_SECRET.length < 32) {
    log.fatal('JWT_SECRET demasiado corto: debe tener al menos 32 caracteres.');
    process.exit(1);
}

// CORS_ORIGINS es opcional: vacío = ningún origen externo permitido
const parsearOrigins = (valor = '') =>
    valor
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

// LOG_LEVEL es opcional: por defecto info (en los tests, silent desde .env.test)
const NIVELES_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const validarLogLevel = (valor = 'info') => {
    if (!NIVELES_LOG.includes(valor)) {
        log.fatal(`LOG_LEVEL invalido: "${valor}" (debe ser uno de: ${NIVELES_LOG.join(', ')})`);
        process.exit(1);
    }
    return valor;
};

// 3. Exportar la configuración ya limpia y con los tipos correctos
export const config = {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    port: validarPort(process.env.PORT, 'PORT'),
    trustProxy: validarTrustProxy(process.env.TRUST_PROXY),
    corsOrigins: parsearOrigins(process.env.CORS_ORIGINS),
    logLevel: validarLogLevel(process.env.LOG_LEVEL),
    db: {
        host: process.env.DB_HOST,
        port: validarPort(process.env.DB_PORT, 'DB_PORT'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME,
    },
};
