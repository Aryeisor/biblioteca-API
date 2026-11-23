import { z } from 'zod';
import { ERROR_CUERPO, esquemaId, textoObligatorio } from './comunes.js';

const MENSAJE_STOCK = 'El stock debe ser un entero mayor o igual a 0';
const esquemaStock = z.coerce.number(MENSAJE_STOCK).int(MENSAJE_STOCK).min(0, MENSAJE_STOCK);

// Cuerpo de POST y PUT /libros. El orden de las claves es el orden en que se reporta el primer error.
export const esquemaLibro = z.object(
    {
        titulo: textoObligatorio(
            'El título es obligatorio',
            200,
            'El título no puede superar 200 caracteres',
        ),
        // ausente, null o "" (o solo espacios) -> null; si viene, debe ser texto de máximo 20
        isbn: z
            .string('ISBN inválido (máximo 20 caracteres)')
            .trim()
            .max(20, 'ISBN inválido (máximo 20 caracteres)')
            .nullish()
            .transform((valor) => valor || null),
        stock: esquemaStock.default(0),
        autorId: esquemaId('autorId'),
    },
    ERROR_CUERPO,
);

// El tipo NO se escribe a mano: sale del esquema. Si cambia una regla, cambia el tipo.
export type DatosLibro = z.infer<typeof esquemaLibro>;

// PATCH /libros/:id/stock: aquí el stock es obligatorio (ausente, null o "" -> 400).
export const esquemaStockObligatorio = z
    .unknown()
    .refine(
        (valor) => valor !== undefined && valor !== null && valor !== '',
        'El stock es obligatorio',
    )
    .pipe(esquemaStock);

// GET /libros?titulo=...  (?titulo=a&titulo=b llega como arreglo: se rechaza)
export const esquemaFiltroTitulo = z.object(
    { titulo: z.string('El filtro titulo debe ser texto').trim().optional() },
    ERROR_CUERPO,
);
