import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/db.js';

// Red de seguridad: nunca tocar la base real
if (!process.env.DB_NAME?.endsWith('_test')) {
    throw new Error(`DB_NAME debe terminar en "_test" (valor actual: "${process.env.DB_NAME}")`);
}

export const api = request(app);

export const limpiarTablas = () =>
    pool.query('TRUNCATE prestamos, libros, autores, usuarios RESTART IDENTITY CASCADE');

export const cerrarPool = () => pool.end();

export const crearUsuarioConToken = async (nombre, email, password = 'clave12345') => {
    const { body: usuario } = await api.post('/auth/registrar').send({ nombre, email, password }).expect(201);
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
