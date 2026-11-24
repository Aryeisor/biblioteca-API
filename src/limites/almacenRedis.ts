import type { ClienteRedis } from '../config/redis.js';
import { PREFIJO_CLAVES, type AlmacenLimites } from './almacen.js';

// INCR y PEXPIRE en UN solo paso atómico (Redis ejecuta el script entero sin intercalar otros comandos).
// Si fueran dos llamadas separadas y el proceso muriera entre ellas, la clave quedaría sin expiración
// y ese contador bloquearía a su dueño para siempre.
// La segunda comprobación (ttl < 0) repara una clave que ya existiera sin expiración.
const SCRIPT_INCREMENTAR = `
local cuenta = redis.call('INCR', KEYS[1])
if cuenta == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return { cuenta, ttl }
`;

export const crearAlmacenRedis = (cliente: ClienteRedis): AlmacenLimites => ({
    incrementar: async (clave, ventanaMs) => {
        const respuesta: unknown = await cliente.eval(SCRIPT_INCREMENTAR, {
            keys: [clave],
            arguments: [String(ventanaMs)],
        });

        // Lo que llega de Redis es "unknown": se comprueba antes de usarlo
        if (!Array.isArray(respuesta) || respuesta.length !== 2) {
            throw new Error('Respuesta inesperada de Redis al incrementar el contador');
        }
        const cuenta = Number(respuesta[0]);
        const msRestantes = Number(respuesta[1]);
        if (!Number.isFinite(cuenta) || !Number.isFinite(msRestantes)) {
            throw new Error('Respuesta inesperada de Redis al incrementar el contador');
        }
        return { cuenta, msRestantes };
    },

    // KEYS recorre todas las claves y bloquea Redis: aceptable en un Redis de pruebas, nunca en producción.
    reiniciar: async () => {
        const claves = await cliente.keys(`${PREFIJO_CLAVES}*`);
        if (claves.length > 0) await cliente.del(claves);
    },
});
