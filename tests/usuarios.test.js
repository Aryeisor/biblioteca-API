import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken } from './helpers.js';

let ana, beto, biblio, admin;

before(async () => {
    await limpiarTablas();
    ana = await crearUsuarioConToken('Ana', 'ana@correo.com');
    beto = await crearUsuarioConToken('Beto', 'beto@correo.com');
    biblio = await crearUsuarioConToken('Bibliotecario', 'biblio@correo.com', undefined, 'bibliotecario');
    admin = await crearUsuarioConToken('Admin', 'admin@correo.com', undefined, 'admin');
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

    it('GET /usuarios como lector da 403', async () => {
        const res = await api.get('/usuarios').set(bearer(ana));
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'PERMISO_DENEGADO');
    });

    it('GET /usuarios como bibliotecario da 200 y sin campo password', async () => {
        const res = await api.get('/usuarios').set(bearer(biblio));
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 4);
        assert.ok(res.body.every((u) => !('password' in u)));
    });

    it('GET /usuarios/:id del propio lector da 200', async () => {
        const res = await api.get(`/usuarios/${ana.id}`).set(bearer(ana));
        assert.equal(res.status, 200);
        assert.equal(res.body.email, 'ana@correo.com');
    });

    it('GET /usuarios/:id de otro usuario como lector da 403', async () => {
        const res = await api.get(`/usuarios/${beto.id}`).set(bearer(ana));
        assert.equal(res.status, 403);
    });

    it('GET /usuarios/:id de otro usuario como bibliotecario da 200 y sin campo password', async () => {
        const res = await api.get(`/usuarios/${beto.id}`).set(bearer(biblio));
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

    it('PUT de bibliotecario sobre otro usuario da 403', async () => {
        const res = await api.put(`/usuarios/${beto.id}`).set(bearer(biblio))
            .send({ nombre: 'Hackeado', email: 'hack@correo.com' });
        assert.equal(res.status, 403);
    });

    it('DELETE de admin sobre otro usuario da 204', async () => {
        const res = await api.delete(`/usuarios/${beto.id}`).set(bearer(admin));
        assert.equal(res.status, 204);
    });

    it('PATCH /usuarios/:id/rol como admin cambia el rol (200)', async () => {
        const res = await api.patch(`/usuarios/${ana.id}/rol`).set(bearer(admin)).send({ rol: 'bibliotecario' });
        assert.equal(res.status, 200);
        assert.equal(res.body.rol, 'bibliotecario');
        assert.equal('password' in res.body, false);
    });

    it('PATCH /usuarios/:id/rol como bibliotecario da 403', async () => {
        const res = await api.patch(`/usuarios/${ana.id}/rol`).set(bearer(biblio)).send({ rol: 'admin' });
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'PERMISO_DENEGADO');
    });

    it('PATCH /usuarios/:id/rol con rol inválido da 400', async () => {
        const res = await api.patch(`/usuarios/${ana.id}/rol`).set(bearer(admin)).send({ rol: 'superadmin' });
        assert.equal(res.status, 400);
    });

    it('PATCH /usuarios/:id/rol: el admin no puede quitarse el rol a sí mismo (400)', async () => {
        const res = await api.patch(`/usuarios/${admin.id}/rol`).set(bearer(admin)).send({ rol: 'lector' });
        assert.equal(res.status, 400);
    });

    it('PATCH /usuarios/:id/rol de un usuario inexistente da 404', async () => {
        const res = await api.patch('/usuarios/9999/rol').set(bearer(admin)).send({ rol: 'lector' });
        assert.equal(res.status, 404);
    });

    it('POST /usuarios ya no existe (404)', async () => {
        const res = await api.post('/usuarios').set(bearer(ana))
            .send({ nombre: 'Nuevo', email: 'nuevo@correo.com' });
        assert.equal(res.status, 404);
    });
});
