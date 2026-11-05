import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken } from './helpers.js';

let ana, beto;

before(async () => {
    await limpiarTablas();
    ana = await crearUsuarioConToken('Ana', 'ana@correo.com');
    beto = await crearUsuarioConToken('Beto', 'beto@correo.com');
});
after(cerrarPool);

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });

describe('Usuarios', () => {
    it('todas las rutas sin token dan 401', async () => {
        const respuestas = await Promise.all([
            api.get('/usuarios'),
            api.get(`/usuarios/${ana.id}`),
            api.put(`/usuarios/${ana.id}`).send({ nombre: 'X', email: 'x@correo.com' }),
            api.delete(`/usuarios/${ana.id}`),
        ]);
        assert.deepEqual(respuestas.map((r) => r.status), [401, 401, 401, 401]);
    });

    it('GET /usuarios con token da 200 y sin campo password', async () => {
        const res = await api.get('/usuarios').set(bearer(ana));
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 2);
        assert.ok(res.body.every((u) => !('password' in u)));
    });

    it('GET /usuarios/:id con token da 200 y sin campo password', async () => {
        const res = await api.get(`/usuarios/${beto.id}`).set(bearer(ana));
        assert.equal(res.status, 200);
        assert.equal(res.body.email, 'beto@correo.com');
        assert.equal('password' in res.body, false);
    });

    it('PUT sobre el propio usuario da 200', async () => {
        const res = await api.put(`/usuarios/${ana.id}`).set(bearer(ana))
            .send({ nombre: 'Ana María', email: 'ana.maria@correo.com' });
        assert.equal(res.status, 200);
        assert.equal(res.body.nombre, 'Ana María');
        assert.equal(res.body.email, 'ana.maria@correo.com');
    });

    it('PUT sobre el propio usuario sin body da 400', async () => {
        const res = await api.put(`/usuarios/${ana.id}`).set(bearer(ana));
        assert.equal(res.status, 400);
    });

    it('PUT sobre otro usuario da 403', async () => {
        const res = await api.put(`/usuarios/${beto.id}`).set(bearer(ana))
            .send({ nombre: 'Hackeado', email: 'hack@correo.com' });
        assert.equal(res.status, 403);
    });

    it('DELETE sobre otro usuario da 403', async () => {
        const res = await api.delete(`/usuarios/${beto.id}`).set(bearer(ana));
        assert.equal(res.status, 403);
    });

    it('POST /usuarios ya no existe (404)', async () => {
        const res = await api.post('/usuarios').set(bearer(ana))
            .send({ nombre: 'Nuevo', email: 'nuevo@correo.com' });
        assert.equal(res.status, 404);
    });
});
