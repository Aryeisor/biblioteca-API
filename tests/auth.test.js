import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
});
