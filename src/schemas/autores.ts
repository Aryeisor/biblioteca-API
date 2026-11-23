import { textoObligatorio } from './comunes.js';

export const esquemaNombreAutor = textoObligatorio(
    'El nombre es obligatorio',
    100,
    'El nombre no puede superar 100 caracteres',
);
