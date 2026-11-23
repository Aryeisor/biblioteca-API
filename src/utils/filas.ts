// Para INSERT ... RETURNING: siempre devuelve una fila. Si no llega, no es un "no encontrado" (404)
// sino un fallo inesperado, así que se lanza un Error normal (el errorHandler lo responde como 500).
// Es la alternativa a rows[0]! : en vez de callar a TypeScript con "!", se comprueba de verdad.
export const primeraFila = <T>(filas: T[], contexto: string): T => {
    const fila = filas[0];
    if (fila === undefined) {
        throw new Error(`${contexto}: la consulta no devolvió ninguna fila`);
    }
    return fila;
};
