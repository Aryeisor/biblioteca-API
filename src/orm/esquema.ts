import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

// ESQUEMA SOLO PARA TIPOS (PR 6: autores, PR 7: libros).
// La fuente de verdad sigue siendo db/migrations/*.sql: Drizzle NO crea ni modifica tablas aquí.
// Esta definición solo le dice a TypeScript cómo es la tabla; si una migración cambia la tabla
// y esto no se actualiza, nadie avisa (ver docs/evaluacion-orm.md, "dos fuentes de verdad").
//
// Se omiten created_at (en libros) y updated_at a propósito: la API no los expone y updated_at lo mantiene
// un trigger (migración 005).
// Tampoco se declaran aquí el UNIQUE de isbn, el CHECK de stock ni la llave foránea: los hace cumplir
// la base (migración 000) y Drizzle no los necesita para generar el SQL de estas consultas.
// Con el nombre de propiedad igual al de la columna (created_at), el tipo inferido coincide con `Autor`.
export const autores = pgTable('autores', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
        .notNull()
        .defaultNow(),
});

export type FilaAutor = typeof autores.$inferSelect;

// Los nombres de propiedad son snake_case, igual que las columnas, para que el resultado de una consulta
// tenga la misma forma que el tipo `Libro` (el contrato con el frontend no cambia).
export const libros = pgTable('libros', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    titulo: varchar('titulo', { length: 200 }).notNull(),
    isbn: varchar('isbn', { length: 20 }), // admite NULL
    autor_id: integer('autor_id').notNull(),
    stock: integer('stock').notNull().default(0),
});
