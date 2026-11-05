import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken, crearAutor, crearLibro } from './helpers.js';

let token, autor, libro;

before(async () => {
    await limpiarTablas();
    ({ token } = await crearUsuarioConToken('Lector', 'lector@correo.com'));
    autor = await crearAutor(token, 'Gabriel García Márquez');
    libro = await crearLibro(token, { titulo: 'Cien años de soledad', autorId: autor.id, stock: 3, isbn: '111' });
});
after(cerrarPool);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Libros: lectura pública', () => {
    it('GET /libros es público y devuelve 200', async () => {
        const res = await api.get('/libros');
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body));
        assert.equal(res.body.length, 1);
    });

    it('GET /libros/:id es público y devuelve 200', async () => {
        const res = await api.get(`/libros/${libro.id}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.titulo, 'Cien años de soledad');
    });

    it('GET /libros/:id inexistente da 404', async () => {
        const res = await api.get('/libros/9999');
        assert.equal(res.status, 404);
    });

    it('GET /libros/:id con id inválido da 400', async () => {
        const res = await api.get('/libros/abc');
        assert.equal(res.status, 400);
    });
});

describe('Libros: creación', () => {
    it('POST /libros sin token da 401', async () => {
        const res = await api.post('/libros').send({ titulo: 'X', autorId: autor.id });
        assert.equal(res.status, 401);
    });

    it('POST /libros con token da 201 e incluye el nombre del autor', async () => {
        const res = await api.post('/libros').set(auth())
            .send({ titulo: 'El amor en los tiempos del cólera', autorId: autor.id, stock: 2, isbn: '222' });
        assert.equal(res.status, 201);
        assert.equal(res.body.autor, 'Gabriel García Márquez');
        assert.equal(res.body.stock, 2);
    });

    it('POST /libros sin body da 400', async () => {
        const res = await api.post('/libros').set(auth());
        assert.equal(res.status, 400);
    });

    it('POST /libros con autorId inexistente da 404', async () => {
        const res = await api.post('/libros').set(auth()).send({ titulo: 'Huérfano', autorId: 9999 });
        assert.equal(res.status, 404);
    });

    it('POST /libros con stock negativo da 400', async () => {
        const res = await api.post('/libros').set(auth()).send({ titulo: 'Negativo', autorId: autor.id, stock: -1 });
        assert.equal(res.status, 400);
    });

    it('POST /libros con ISBN repetido da 409', async () => {
        const res = await api.post('/libros').set(auth()).send({ titulo: 'Copia', autorId: autor.id, isbn: '111' });
        assert.equal(res.status, 409);
    });
});

describe('Libros: PATCH /libros/:id/stock', () => {
    it('actualiza el stock con un valor válido (200)', async () => {
        const res = await api.patch(`/libros/${libro.id}/stock`).set(auth()).send({ stock: 10 });
        assert.equal(res.status, 200);
        assert.equal(res.body.stock, 10);
    });

    it('rechaza stock negativo (400)', async () => {
        const res = await api.patch(`/libros/${libro.id}/stock`).set(auth()).send({ stock: -5 });
        assert.equal(res.status, 400);
    });

    it('rechaza un body sin stock (400)', async () => {
        const res = await api.patch(`/libros/${libro.id}/stock`).set(auth()).send({});
        assert.equal(res.status, 400);
    });

    it('una petición sin body da 400', async () => {
        const res = await api.patch(`/libros/${libro.id}/stock`).set(auth());
        assert.equal(res.status, 400);
    });

    it('da 404 si el libro no existe', async () => {
        const res = await api.patch('/libros/9999/stock').set(auth()).send({ stock: 1 });
        assert.equal(res.status, 404);
    });
});

describe('Libros: filtro por título', () => {
    it('GET /libros?titulo= filtra sin distinguir mayúsculas', async () => {
        const res = await api.get('/libros').query({ titulo: 'CIEN' });
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].titulo, 'Cien años de soledad');
    });

    it('GET /libros?titulo= sin coincidencias devuelve lista vacía', async () => {
        const res = await api.get('/libros').query({ titulo: 'no-existe' });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, []);
    });
});
