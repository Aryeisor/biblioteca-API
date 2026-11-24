// Dónde se guardan los contadores del rate limiting. El middleware solo conoce esta forma:
// puede ser memoria (un proceso) o Redis (varias instancias) sin cambiar nada más.

export type ResultadoLimite = {
    cuenta: number; // cuántas peticiones lleva la clave en la ventana actual (incluye esta)
    msRestantes: number; // cuánto falta para que la ventana se reinicie
};

export type AlmacenLimites = {
    // Suma 1 a la clave. La primera vez abre la ventana: dura ventanaMs desde ese momento.
    incrementar: (clave: string, ventanaMs: number) => Promise<ResultadoLimite>;
    // Borra todos los contadores. Solo para los tests.
    reiniciar: () => Promise<void>;
};

// Todas las claves del limitador empiezan así: en Redis comparten servidor con otros datos.
export const PREFIJO_CLAVES = 'rl:';
