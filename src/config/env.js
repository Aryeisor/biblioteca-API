// src/config/env.js
import 'dotenv/config';

// 1. Lista de variables OBLIGATORIA
const requeridas = ['JWT_SECRET', 'JWT_EXPIRES_IN', 
    'PORT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

// 2. Revisar cuáles faltan
const faltantes = requeridas.filter((nombre) => !process.env[nombre]);

if (faltantes.length > 0) {
  console.error(`❌ Faltan variables de entorno: ${faltantes.join(', ')}`);
  process.exit(1);
}

const validarPort = (valor , nombre) =>{
    const n = Number(valor);
    if(!Number.isInteger(n) || n < 1 || n > 65535){
        console.error(`${nombre} invalido: ${valor} (debe ser un entero entre 1 y 65535)`);
        process.exit(1);
    }
    return n;
};

if (process.env.JWT_SECRET.length < 32){
    console.error('JWT_SECRET demasiado corto: debe tener al menos 32 caracteres.');
    process.exit(1);
}

// 3. Exportar la configuración ya limpia y con los tipos correctos
export const config = {
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  port: validarPort(process.env.PORT, 'PORT'),
  db:{
    host: process.env.DB_HOST,
    port: validarPort(process.env.DB_PORT, 'DB_PORT'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME
  }
};