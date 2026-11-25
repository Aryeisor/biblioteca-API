import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    api,
    limpiarTablas,
    cerrarPool,
    crearUsuarioConToken,
    crearAutor,
    crearLibro,
} from './helpers.js';

let token: string;
let tokenAdmin: string;

before(async () => {
    await limpiarTablas();
    ({ token } = await crearUsuarioConToken(
        'Bibliotecario',
        'biblio@correo.com',
        undefined,
        'bibliotecario',
    ));
    ({ token: tokenAdmin } = await crearUsuarioConToken(
        'Admin',
        'admin@correo.com',
        undefined,
        'admin',
    ));
});
after(cerrarPool);

// Estos tests cubren el repositorio de autores (reescrito con Drizzle en el PR 6):
// mismas respuestas HTTP que cuando usaba SQL a mano.
describe('Autores', () => {
    it('POST /autores sin body da 400', async () => {
        const res = await api.post('/autores').set('Authorization', `Bearer ${token}`);
        assert.equal(res.status, 400);
    });

    it('POST /autores crea y devuelve id, nombre y created_at (sin updated_at)', async () => {
        const res = await api
            .post('/autores')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Julio Cortázar' });
        assert.equal(res.status, 201);
        assert.equal(res.body.nombre, 'Julio Cortázar');
        assert.equal(typeof res.body.id, 'number');
        assert.ok(!Number.isNaN(Date.parse(res.body.created_at)));
        assert.equal('updated_at' in res.body, false);
    });

    it('GET /autores lista ordenado por id y GET /autores/:id da 404 si no existe', async () => {
        const a = await crearAutor(token, 'Ana');
        const b = await crearAutor(token, 'Beto');
        const lista = await api.get('/autores');
        assert.equal(lista.status, 200);
        const ids: number[] = lista.body.map((x: { id: number }) => x.id);
        assert.deepEqual(
            ids,
            [...ids].sort((x, y) => x - y),
        );
        assert.ok(ids.includes(a.id) && ids.includes(b.id));
        assert.equal((await api.get('/autores/999999')).status, 404);
    });

    it('PUT /autores/:id actualiza y da 404 si no existe', async () => {
        const a = await crearAutor(token, 'Nombre viejo');
        const ok = await api
            .put(`/autores/${a.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Nombre nuevo' });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.nombre, 'Nombre nuevo');
        const noExiste = await api
            .put('/autores/999999')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'X' });
        assert.equal(noExiste.status, 404);
    });

    it('DELETE /autores/:id da 204 y luego 404', async () => {
        const a = await crearAutor(token, 'Para borrar');
        const primero = await api
            .delete(`/autores/${a.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);
        assert.equal(primero.status, 204);
        const segundo = await api
            .delete(`/autores/${a.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);
        assert.equal(segundo.status, 404);
    });

    // Cubre el riesgo de Drizzle: envuelve el error de pg y errorHandler debe seguir leyendo el código 23503
    it('DELETE de un autor con libros da 409 REGISTRO_RELACIONADO', async () => {
        const a = await crearAutor(token, 'Con libros');
        await crearLibro(token, { titulo: 'Un libro', autorId: a.id });
        const res = await api
            .delete(`/autores/${a.id}`)
            .set('Authorization', `Bearer ${tokenAdmin}`);
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'REGISTRO_RELACIONADO');
    });
});
