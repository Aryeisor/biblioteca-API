import { describe, it, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, cerrarPool } from './helpers.js';
import { marcarApagando } from '../src/config/estado.js';

after(cerrarPool);

describe('Health checks', () => {
    afterEach(() => marcarApagando(false));

    it('GET /health (liveness) da 200 sin token', async () => {
        const res = await api.get('/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
    });

    it('GET /health/ready da 200 con la base disponible', async () => {
        const res = await api.get('/health/ready');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
    });

    it('GET /health/ready da 503 APAGANDO durante el apagado, y /health sigue en 200', async () => {
        marcarApagando();
        const ready = await api.get('/health/ready');
        assert.equal(ready.status, 503);
        assert.equal(ready.body.code, 'APAGANDO');
        assert.equal((await api.get('/health')).status, 200);
    });
});
