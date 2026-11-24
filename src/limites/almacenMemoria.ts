import type { AlmacenLimites } from './almacen.js';

type Registro = { cuenta: number; reiniciaEn: number };

// Un Map en la memoria del proceso: sin dependencias, pero los contadores se pierden al reiniciar
// y no se comparten entre instancias. Sirve para desarrollo y para una sola instancia.
export const crearAlmacenMemoria = (): AlmacenLimites => {
    const registros = new Map<string, Registro>();

    // Borra los contadores vencidos para que el Map no crezca sin límite.
    // unref() evita que este temporizador mantenga vivo el proceso.
    setInterval(() => {
        const ahora = Date.now();
        for (const [clave, registro] of registros) {
            if (ahora >= registro.reiniciaEn) registros.delete(clave);
        }
    }, 60_000).unref();

    return {
        incrementar: (clave, ventanaMs) => {
            const ahora = Date.now();
            let registro = registros.get(clave);
            if (!registro || ahora >= registro.reiniciaEn) {
                registro = { cuenta: 0, reiniciaEn: ahora + ventanaMs };
                registros.set(clave, registro);
            }
            registro.cuenta++;
            return Promise.resolve({
                cuenta: registro.cuenta,
                msRestantes: registro.reiniciaEn - ahora,
            });
        },
        reiniciar: () => {
            registros.clear();
            return Promise.resolve();
        },
    };
};
