import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken, crearAutor, crearLibro } from './helpers.js';
import pool from '../src/config/db.js';

let ana, beto, biblio, libro, sinStock, otroLibro, prestamo, prestamoBeto;

before(async () => {
    await limpiarTablas();
    ana = await crearUsuarioConToken('Ana', 'ana@correo.com');
    beto = await crearUsuarioConToken('Beto', 'beto@correo.com');
    biblio = await crearUsuarioConToken('Bibliotecario', 'biblio@correo.com', undefined, 'bibliotecario');
    const autor = await crearAutor(biblio.token, 'Jorge Luis Borges');
    libro = await crearLibro(biblio.token, { titulo: 'Ficciones', autorId: autor.id, stock: 2 });
    sinStock = await crearLibro(biblio.token, { titulo: 'El Aleph', autorId: autor.id, stock: 0 });
    otroLibro = await crearLibro(biblio.token, { titulo: 'El libro de arena', autorId: autor.id, stock: 5 });
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

    it('un lector no puede devolver, ni su propio préstamo (403)', async () => {
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(ana));
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'PERMISO_DENEGADO');
        assert.equal(await stockDe(libro.id), 1);
    });

    it('GET /prestamos?activos=true solo lista los no devueltos', async () => {
        // préstamo de Beto que se devuelve, para que haya uno activo y uno devuelto
        const otro = await api.post('/prestamos').set(bearer(beto)).send({ libroId: libro.id });
        prestamoBeto = otro.body;
        await api.patch(`/prestamos/${otro.body.id}/devolver`).set(bearer(biblio)).expect(200);

        const todos = await api.get('/prestamos').set(bearer(biblio));
        const activos = await api.get('/prestamos').query({ activos: 'true' }).set(bearer(biblio));
        assert.equal(activos.status, 200);
        assert.equal(todos.body.data.length, 2);
        assert.deepEqual(activos.body.data.map((p) => p.id), [prestamo.id]);
        assert.ok(activos.body.data.every((p) => p.fecha_devolucion === null));
    });

    it('un lector que lista préstamos solo ve los suyos', async () => {
        const res = await api.get('/prestamos').set(bearer(ana));
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.map((p) => p.id), [prestamo.id]);
    });

    it('GET /prestamos/:id: el lector ve el suyo (200) pero no el ajeno (403)', async () => {
        const propio = await api.get(`/prestamos/${prestamo.id}`).set(bearer(ana));
        const ajeno = await api.get(`/prestamos/${prestamoBeto.id}`).set(bearer(ana));
        assert.equal(propio.status, 200);
        assert.equal(ajeno.status, 403);
    });

    it('devuelve un préstamo: 200, fecha_devolucion llena y el stock sube en 1', async () => {
        const antes = await stockDe(libro.id);
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(biblio));
        assert.equal(res.status, 200);
        assert.notEqual(res.body.fecha_devolucion, null);
        assert.equal(await stockDe(libro.id), antes + 1);
    });

    it('devolver dos veces da 409 y el stock no vuelve a subir', async () => {
        const antes = await stockDe(libro.id);
        const res = await api.patch(`/prestamos/${prestamo.id}/devolver`).set(bearer(biblio));
        assert.equal(res.status, 409);
        assert.equal(await stockDe(libro.id), antes);
    });

    it('si un lector envía usuarioId, se ignora y el préstamo queda a su nombre', async () => {
        const res = await api.post('/prestamos').set(bearer(ana)).send({ libroId: otroLibro.id, usuarioId: beto.id });
        assert.equal(res.status, 201);
        assert.equal(res.body.usuario_id, ana.id);
    });

    it('el bibliotecario puede prestar a nombre de otro usuario', async () => {
        const res = await api.post('/prestamos').set(bearer(biblio)).send({ libroId: otroLibro.id, usuarioId: beto.id });
        assert.equal(res.status, 201);
        assert.equal(res.body.usuario_id, beto.id);
    });

    it('concurrencia: con stock 1, dos préstamos en paralelo dan un 201 y un 409', async () => {
        const autor = await api.get('/autores').then((r) => r.body[0]);
        const unico = await crearLibro(biblio.token, { titulo: 'El jardín de senderos', autorId: autor.id, stock: 1 });

        const respuestas = await Promise.all([
            api.post('/prestamos').set(bearer(ana)).send({ libroId: unico.id }),
            api.post('/prestamos').set(bearer(beto)).send({ libroId: unico.id }),
        ]);
        const codigos = respuestas.map((r) => r.status).sort();
        assert.deepEqual(codigos, [201, 409]);
        assert.equal(await stockDe(unico.id), 0);
    });
});

describe('Préstamos: paginación con cursor', () => {
    // Sigue siguienteCursor hasta null y devuelve todos los ids en el orden recibido.
    const recorrer = async (usuario, query) => {
        const ids = [];
        let cursor;
        for (let i = 0; i < 50; i++) { // tope de seguridad: un bug no debe colgar la prueba
            const res = await api.get('/prestamos').query({ ...query, cursor }).set(bearer(usuario));
            assert.equal(res.status, 200);
            assert.ok(res.body.data.length > 0, 'con limite + 1 nunca debe salir una página vacía');
            assert.ok(res.body.data.length <= query.limite);
            ids.push(...res.body.data.map((p) => p.id));
            cursor = res.body.paginacion.siguienteCursor;
            if (cursor === null) return ids;
        }
        assert.fail('siguienteCursor nunca llegó a null');
    };

    // La verdad sale de la base, no de la API que estamos probando.
    const idsEnBase = async (where = 'TRUE', params = []) =>
        (await pool.query(`SELECT id FROM prestamos WHERE ${where} ORDER BY id DESC`, params)).rows.map((r) => r.id);

    before(async () => {
        const autor = await api.get('/autores').then((r) => r.body[0]);
        const muchos = await crearLibro(biblio.token, { titulo: 'Historia universal de la infamia', autorId: autor.id, stock: 20 });
        for (const u of [ana, beto, ana, ana, beto, ana, beto, ana]) {
            const { body } = await api.post('/prestamos').set(bearer(u)).send({ libroId: muchos.id }).expect(201);
            if (body.id % 3 === 0) await api.patch(`/prestamos/${body.id}/devolver`).set(bearer(biblio)).expect(200);
        }
    });

    it('recorre todas las páginas sin repetidos ni faltantes, del más reciente al más viejo', async () => {
        const ids = await recorrer(biblio, { limite: 3 });
        assert.equal(new Set(ids).size, ids.length);
        assert.deepEqual(ids, await idsEnBase());
    });

    it('el cursor se combina con ?activos=true', async () => {
        const ids = await recorrer(biblio, { limite: 2, activos: 'true' });
        assert.deepEqual(ids, await idsEnBase('fecha_devolucion IS NULL'));
    });

    it('un lector pagina solo sus préstamos', async () => {
        const ids = await recorrer(ana, { limite: 2 });
        assert.deepEqual(ids, await idsEnBase('usuario_id = $1', [ana.id]));
    });

    it('siguienteCursor es null cuando todo cabe en una página', async () => {
        const res = await api.get('/prestamos').query({ limite: 100 }).set(bearer(biblio));
        assert.equal(res.body.paginacion.siguienteCursor, null);
    });

    const invalidos = ['abc', '', Buffer.from('{"id":"x"}').toString('base64url'), Buffer.from('{"id":-1}').toString('base64url')];
    for (const cursor of invalidos) {
        it(`cursor inválido ${JSON.stringify(cursor)} da 400 CURSOR_INVALIDO`, async () => {
            const res = await api.get('/prestamos').query({ cursor }).set(bearer(biblio));
            assert.equal(res.status, 400);
            assert.equal(res.body.code, 'CURSOR_INVALIDO');
        });
    }

    it('limite inválido da 400', async () => {
        const res = await api.get('/prestamos').query({ limite: 5000 }).set(bearer(biblio));
        assert.equal(res.status, 400);
    });
});
