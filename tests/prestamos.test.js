import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken, crearAutor, crearLibro } from './helpers.js';

let ana, beto, libro, sinStock, prestamo;

before(async () => {
    await limpiarTablas();
    ana = await crearUsuarioConToken('Ana', 'ana@correo.com');
    beto = await crearUsuarioConToken('Beto', 'beto@correo.com');
    const autor = await crearAutor(ana.token, 'Jorge Luis Borges');
    libro = await crearLibro(ana.token, { titulo: 'Ficciones', autorId: autor.id, stock: 2 });
    sinStock = await crearLibro(ana.token, { titulo: 'El Aleph', autorId: autor.id, stock: 0 });
});
after(cerrarPool);

const bearer = (u) => ({ Authorization: `Bearer ${u.token}` });
const stockDe = async (id) => (await api.get(`/libros/${id}`)).body.stock;

describe('Préstamos', () => {
    it('presta un libro: 201, usuario del token y el stock baja en 1', async () => {
        const res = await api.post('/prestamos').set(bearer(ana)).send({ libroId: libro.id });
        assert.equal(res.status, 201);
        assert.equal(res.body.usuario_id, ana.id);
        assert.equal(res.body.libro_id, libro.id);
        assert.equal(res.body.fecha_devolucion, null);
        assert.equal(await stockDe(libro.id), 1);
        prestamo = res.body;
    });

    it('prestar un libro sin stock da 409', async () => {
        const res = await api.post('/prestamos').set(bearer(ana)).send({ libroId: sinStock.id });
        assert.equal(res.status, 409);
    });

    it('prestar un libro inexistente da 404', async () => {
        const res = await api.post('/prestamos').set(bearer(ana)).send({ libroId: 9999 });
        assert.equal(res.status, 404);
    });

    it('prestar con libroId inválido da 400', async () => {
        const res = await api.post('/prestamos').set(bearer(ana)).send({ libroId: 'abc' });
        assert.equal(res.status, 400);
    });

    it('POST /prestamos sin body da 400', async () => {
        const res = await api.post('/prestamos').set(bearer(ana));
        assert.equal(res.status, 400);
    });

    it('devolver el préstamo de otro usuario da 403', async () => {
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(beto));
        assert.equal(res.status, 403);
        assert.equal(await stockDe(libro.id), 1);
    });

    it('GET /prestamos?activos=true solo lista los no devueltos', async () => {
        // préstamo de Beto que se devuelve, para que haya uno activo y uno devuelto
        const otro = await api.post('/prestamos').set(bearer(beto)).send({ libroId: libro.id });
        await api.patch(`/prestamos/${otro.body.id}/devolver`).set(bearer(beto)).expect(200);

        const todos = await api.get('/prestamos').set(bearer(ana));
        const activos = await api.get('/prestamos').query({ activos: 'true' }).set(bearer(ana));
        assert.equal(activos.status, 200);
        assert.equal(todos.body.length, 2);
        assert.deepEqual(activos.body.map((p) => p.id), [prestamo.id]);
        assert.ok(activos.body.every((p) => p.fecha_devolucion === null));
    });

    it('devuelve un préstamo: 200, fecha_devolucion llena y el stock sube en 1', async () => {
        const antes = await stockDe(libro.id);
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(ana));
        assert.equal(res.status, 200);
        assert.notEqual(res.body.fecha_devolucion, null);
        assert.equal(await stockDe(libro.id), antes + 1);
    });

    it('devolver dos veces da 409 y el stock no vuelve a subir', async () => {
        const antes = await stockDe(libro.id);
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(ana));
        assert.equal(res.status, 409);
        assert.equal(await stockDe(libro.id), antes);
    });

    it('concurrencia: con stock 1, dos préstamos en paralelo dan un 201 y un 409', async () => {
        const autor = await api.get('/autores').then((r) => r.body[0]);
        const unico = await crearLibro(ana.token, { titulo: 'El jardín de senderos', autorId: autor.id, stock: 1 });

        const respuestas = await Promise.all([
            api.post('/prestamos').set(bearer(ana)).send({ libroId: unico.id }),
            api.post('/prestamos').set(bearer(beto)).send({ libroId: unico.id }),
        ]);
        const codigos = respuestas.map((r) => r.status).sort();
        assert.deepEqual(codigos, [201, 409]);
        assert.equal(await stockDe(unico.id), 0);
    });
});
