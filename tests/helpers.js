import { beforeEach } from 'node:test';
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import { reiniciarLimites } from '../src/middlewares/rateLimit.js';

// Supertest usa siempre la misma IP: vaciar los contadores antes de cada test (límites reales, sin desactivarlos)
beforeEach(reiniciarLimites);

// Red de seguridad: nunca tocar la base real
if (!process.env.DB_NAME?.endsWith('_test')) {
    throw new Error(`DB_NAME debe terminar en "_test" (valor actual: "${process.env.DB_NAME}")`);
}

export const api = request(app);

export const limpiarTablas = () =>
    pool.query('TRUNCATE prestamos, libros, autores, usuarios RESTART IDENTITY CASCADE');

export const cerrarPool = () => pool.end();

// rol se asigna por SQL (como el primer admin): la API siempre registra como lector
export const crearUsuarioConToken = async (nombre, email, password = 'clave12345', rol) => {
    const { body: usuario } = await api.post('/auth/registrar').send({ nombre, email, password }).expect(201);
    if (rol) await pool.query('UPDATE usuarios SET rol = $1 WHERE id = $2', [rol, usuario.id]);
    const { body } = await api.post('/auth/login').send({ email, password }).expect(200);
    return { id: usuario.id, token: body.token };
};

export const crearAutor = async (token, nombre) => {
    const { body } = await api.post('/autores').set('Authorization', `Bearer ${token}`).send({ nombre }).expect(201);
    return body;
};

export const crearLibro = async (token, { titulo, autorId, stock, isbn }) => {
    const { body } = await api.post('/libros').set('Authorization', `Bearer ${token}`)
        .send({ titulo, autorId, stock, isbn }).expect(201);
    return body;
};
