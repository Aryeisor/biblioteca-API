import { drizzle } from 'drizzle-orm/node-postgres';
import pool from '../config/db.js';
import * as esquema from './esquema.js';

// Drizzle reutiliza el Pool existente: misma conexión, mismos límites, mismo cierre en el apagado.
// No abre conexiones propias.
export const db = drizzle({ client: pool, schema: esquema });
