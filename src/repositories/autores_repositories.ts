import { asc, eq } from 'drizzle-orm';
import { db } from '../orm/cliente.js';
import { autores } from '../orm/esquema.js';
import type { Autor } from '../types/dominio.js';
import { primeraFila } from '../utils/filas.js';

// Solo acceso a datos, nada de reglas de negocio.
// Experimento PR 6: este repositorio usa Drizzle; los demás siguen con SQL a mano.
// Las firmas exportadas son idénticas a las de la versión con pg: servicios y tests no cambian.
// Los tipos de retorno (Autor) comprueban que lo inferido desde el esquema coincide con el tipo del dominio.

export const listar = async (): Promise<Autor[]> => {
    return db.select().from(autores).orderBy(asc(autores.id));
};

// La desestructuración da "Autor | undefined" (noUncheckedIndexedAccess): el servicio decide si es un 404
export const buscarPorId = async (id: number): Promise<Autor | undefined> => {
    const [autor] = await db.select().from(autores).where(eq(autores.id, id));
    return autor;
};

export const crear = async (nombre: string): Promise<Autor> => {
    const filas = await db.insert(autores).values({ nombre }).returning();
    return primeraFila(filas, 'INSERT autores');
};

export const actualizar = async (id: number, nombre: string): Promise<Autor | undefined> => {
    const [autor] = await db.update(autores).set({ nombre }).where(eq(autores.id, id)).returning();
    return autor;
};

export const eliminar = async (id: number): Promise<boolean> => {
    const filas = await db.delete(autores).where(eq(autores.id, id)).returning({ id: autores.id });
    return filas.length > 0;
};
