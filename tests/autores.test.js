import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, limpiarTablas, cerrarPool, crearUsuarioConToken } from './helpers.js';

let token;

before(async () => {
    await limpiarTablas();
    ({ token } = await crearUsuarioConToken('Lector', 'lector@correo.com'));
});
after(cerrarPool);

describe('Autores', () => {
    it('POST /autores sin body da 400', async () => {
        const res = await api.post('/autores').set('Authorization', `Bearer ${token}`);
        assert.equal(res.status, 400);
    });
});
