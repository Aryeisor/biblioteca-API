import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { api, limpiarTablas, cerrarPool } from './helpers.js';

before(limpiarTablas);
after(cerrarPool);

describe('Autenticación', () => {
    it('registra un usuario: 201, email en minúsculas y sin password', async () => {
        const res = await api.post('/auth/registrar')
            .send({ nombre: 'Ana', email: '  ANA@Correo.COM ', password: 'clave12345' });
        assert.equal(res.status, 201);
        assert.equal(res.body.email, 'ana@correo.com');
        assert.equal(res.body.nombre, 'Ana');
        assert.ok(res.body.id);
        assert.equal('password' in res.body, false);
    });

    it('rechaza un email repetido con 409', async () => {
        const res = await api.post('/auth/registrar')
            .send({ nombre: 'Otra Ana', email: 'ana@correo.com', password: 'clave12345' });
        assert.equal(res.status, 409);
    });

    it('rechaza una contraseña corta con 400', async () => {
        const res = await api.post('/auth/registrar')
            .send({ nombre: 'Beto', email: 'beto@correo.com', password: 'corta' });
        assert.equal(res.status, 400);
    });

    it('rechaza un email con formato inválido con 400', async () => {
        const res = await api.post('/auth/registrar')
            .send({ nombre: 'Beto', email: 'no-es-un-email', password: 'clave12345' });
        assert.equal(res.status, 400);
    });

    it('hace login correcto: 200 con token', async () => {
        const res = await api.post('/auth/login').send({ email: 'ana@correo.com', password: 'clave12345' });
        assert.equal(res.status, 200);
        assert.equal(typeof res.body.token, 'string');
        assert.ok(res.body.token.length > 0);
    });

    it('contraseña incorrecta y email inexistente dan 401 con el mismo mensaje', async () => {
        const malaClave = await api.post('/auth/login').send({ email: 'ana@correo.com', password: 'incorrecta1' });
        const noExiste = await api.post('/auth/login').send({ email: 'nadie@correo.com', password: 'clave12345' });
        assert.equal(malaClave.status, 401);
        assert.equal(noExiste.status, 401);
        assert.equal(malaClave.body.message, noExiste.body.message);
    });

    it('GET /prestamos sin token da 401', async () => {
        const res = await api.get('/prestamos');
        assert.equal(res.status, 401);
    });

    it('GET /prestamos con token inválido da 401', async () => {
        const res = await api.get('/prestamos').set('Authorization', 'Bearer token-falso');
        assert.equal(res.status, 401);
    });

    it('token vencido da 401 TOKEN_EXPIRADO', async () => {
        const vencido = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret);
        const res = await api.get('/prestamos').set('Authorization', `Bearer ${vencido}`);
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'TOKEN_EXPIRADO');
    });

    it('token con la firma alterada da 401 TOKEN_INVALIDO', async () => {
        const { body } = await api.post('/auth/login').send({ email: 'ana@correo.com', password: 'clave12345' });
        const [header, payload, firma] = body.token.split('.');
        const alterado = `${header}.${payload}.${firma.slice(0, -2)}xx`;
        const res = await api.get('/prestamos').set('Authorization', `Bearer ${alterado}`);
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'TOKEN_INVALIDO');
    });
});

describe('Rate limiting', () => {
    it('el 6º intento con el mismo email (aunque cambien mayúsculas) da 429 con Retry-After', async () => {
        const variantes = ['ana@correo.com', 'ANA@correo.com', 'Ana@Correo.com', ' ana@correo.com ', 'aNa@CORREO.com'];
        for (const email of variantes) {
            const res = await api.post('/auth/login').send({ email, password: 'incorrecta1' });
            assert.equal(res.status, 401);
        }
        const res = await api.post('/auth/login').send({ email: 'ANA@CORREO.COM', password: 'clave12345' });
        assert.equal(res.status, 429);
        assert.equal(res.body.code, 'DEMASIADOS_INTENTOS');
        assert.ok(Number(res.headers['retry-after']) > 0);
    });

    it('otro email no se ve afectado por el límite de ana', async () => {
        for (let i = 0; i < 6; i++) await api.post('/auth/login').send({ email: 'ana@correo.com', password: 'x' });
        const res = await api.post('/auth/login').send({ email: 'nadie@correo.com', password: 'clave12345' });
        assert.equal(res.status, 401);
    });

    it('más de 20 peticiones desde la misma IP dan 429 DEMASIADAS_PETICIONES', async () => {
        for (let i = 0; i < 20; i++) await api.post('/auth/login').send({ email: `u${i}@correo.com`, password: 'x' });
        const res = await api.post('/auth/login').send({ email: 'otro@correo.com', password: 'x' });
        assert.equal(res.status, 429);
        assert.equal(res.body.code, 'DEMASIADAS_PETICIONES');
    });
});
