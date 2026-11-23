import { z } from 'zod';
import { ROLES } from '../types/dominio.js';
import { ERROR_CUERPO, textoObligatorio } from './comunes.js';

export const esquemaNombre = textoObligatorio(
    'El nombre es obligatorio',
    100,
    'El nombre no puede superar 100 caracteres',
);

// trim y toLowerCase se aplican antes de validar: el email queda normalizado.
export const esquemaEmail = z
    .string('El correo es obligatorio')
    .trim()
    .toLowerCase()
    .min(1, 'El correo es obligatorio')
    .max(150, 'El email no puede superar los 150 caracteres')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El formato del email no es válido');

// La contraseña NO se recorta (los espacios cuentan), pero una de solo espacios es "vacía".
export const esquemaPassword = z
    .string('La contraseña es obligatoria')
    .refine((p) => p.trim() !== '', 'La contraseña es obligatoria')
    .min(8, 'Debe contener minimo 8 caracteres')
    .max(72, 'No puede superar el máximo de 72 caracteres');

export const esquemaActualizarUsuario = z.object(
    { nombre: esquemaNombre, email: esquemaEmail },
    ERROR_CUERPO,
);

export const esquemaRol = z.object(
    { rol: z.enum(ROLES, `El rol debe ser uno de: ${ROLES.join(', ')}`) },
    ERROR_CUERPO,
);

export const esquemaRegistro = z.object(
    { nombre: esquemaNombre, email: esquemaEmail, password: esquemaPassword },
    ERROR_CUERPO,
);

// En el login no se revela qué regla falló: el mismo mensaje para todo (y la misma respuesta
// 401 si el usuario no existe o la clave es incorrecta). El email solo se normaliza.
const OBLIGATORIOS = 'Email y contraseñas son obligatorios';
export const esquemaLogin = z.object(
    {
        email: z.string(OBLIGATORIOS).trim().toLowerCase(),
        password: z.string(OBLIGATORIOS).refine((p) => p.trim() !== '', OBLIGATORIOS),
    },
    { error: OBLIGATORIOS },
);
