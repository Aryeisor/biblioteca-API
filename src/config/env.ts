// src/config/env.ts
import 'dotenv/config';
import pino from 'pino';

// No se puede usar logger.ts: él importa este archivo para leer LOG_LEVEL (import circular).
// Logger mínimo solo para los errores de arranque; fatal siempre se muestra.
const log = pino();

// 1. Leer las variables OBLIGATORIAS.
// process.env.X es "string | undefined". Esta función siempre devuelve string: si falta la variable
// la anota y, como más abajo se sale del proceso, ese valor vacío nunca llega a usarse.
const faltantes: string[] = [];
const requerida = (nombre: string): string => {
    const valor = process.env[nombre];
    if (!valor) {
        faltantes.push(nombre);
        return '';
    }
    return valor;
};

const jwtSecret = requerida('JWT_SECRET');
const jwtExpiresIn = requerida('JWT_EXPIRES_IN');
const port = requerida('PORT');
const dbHost = requerida('DB_HOST');
const dbPort = requerida('DB_PORT');
const dbUser = requerida('DB_USER');
const dbPassword = requerida('DB_PASSWORD');
const dbName = requerida('DB_NAME');

// 2. Si falta alguna, avisar de TODAS juntas y no arrancar
if (faltantes.length > 0) {
    log.fatal(`Faltan variables de entorno: ${faltantes.join(', ')}`);
    process.exit(1);
}

//validar que el puerto sea un numero entre 1 y 65535
const validarPort = (valor: string, nombre: string): number => {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        log.fatal(`${nombre} invalido: ${valor} (debe ser un entero entre 1 y 65535)`);
        process.exit(1);
    }
    return n;
};

// TRUST_PROXY es opcional: sin proxy (tu PC) lo seguro es 0
const validarTrustProxy = (valor = '0'): number => {
    const n = Number(valor);
    if (valor.trim() === '' || !Number.isInteger(n) || n < 0) {
        log.fatal(`TRUST_PROXY invalido: "${valor}" (debe ser un entero >= 0)`);
        process.exit(1);
    }
    return n;
};

if (jwtSecret.length < 32) {
    log.fatal('JWT_SECRET demasiado corto: debe tener al menos 32 caracteres.');
    process.exit(1);
}

// CORS_ORIGINS es opcional: vacío = ningún origen externo permitido
const parsearOrigins = (valor = ''): string[] =>
    valor
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

// LOG_LEVEL es opcional: por defecto info (en los tests, silent desde .env.test)
// "as const" convierte la lista en los valores exactos: el tipo NivelLog sale de ella (una sola fuente).
const NIVELES_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
type NivelLog = (typeof NIVELES_LOG)[number];

// Type guard: si devuelve true, TypeScript trata `valor` como NivelLog a partir de ahí
const esNivelLog = (valor: string): valor is NivelLog =>
    (NIVELES_LOG as readonly string[]).includes(valor);

const validarLogLevel = (valor = 'info'): NivelLog => {
    if (!esNivelLog(valor)) {
        log.fatal(`LOG_LEVEL invalido: "${valor}" (debe ser uno de: ${NIVELES_LOG.join(', ')})`);
        process.exit(1);
    }
    // process.exit devuelve "never": aquí TypeScript sabe que valor ya es un NivelLog
    return valor;
};

// 3. Exportar la configuración ya limpia y con los tipos correctos
export const config = {
    jwtSecret,
    jwtExpiresIn,
    port: validarPort(port, 'PORT'),
    trustProxy: validarTrustProxy(process.env.TRUST_PROXY),
    corsOrigins: parsearOrigins(process.env.CORS_ORIGINS),
    logLevel: validarLogLevel(process.env.LOG_LEVEL),
    db: {
        host: dbHost,
        port: validarPort(dbPort, 'DB_PORT'),
        user: dbUser,
        password: dbPassword,
        name: dbName,
    },
};
