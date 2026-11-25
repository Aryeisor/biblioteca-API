import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

// ESQUEMA SOLO PARA TIPOS (experimento PR 6).
// La fuente de verdad sigue siendo db/migrations/*.sql: Drizzle NO crea ni modifica tablas aquí.
// Esta definición solo le dice a TypeScript cómo es la tabla; si una migración cambia la tabla
// y esto no se actualiza, nadie avisa (ver docs/evaluacion-orm.md, "dos fuentes de verdad").
//
// Se omite updated_at a propósito: lo mantiene un trigger (migración 005) y no debe salir en la API.
// Con el nombre de propiedad igual al de la columna (created_at), el tipo inferido coincide con `Autor`.
export const autores = pgTable('autores', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
        .notNull()
        .defaultNow(),
});

export type FilaAutor = typeof autores.$inferSelect;
