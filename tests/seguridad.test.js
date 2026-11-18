import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, cerrarPool } from './helpers.js';
import { config } from '../src/config/env.js';

after(cerrarPool);

// Ruta inexistente: los headers los ponen helmet y cors antes de llegar a las rutas, sin tocar la BD
const RUTA = '/ruta-inexistente';

describe('Headers de seguridad (helmet)', () => {
    it('no expone x-powered-by y manda nosniff', async () => {
        const res = await api.get(RUTA);
        assert.equal(res.headers['x-powered-by'], undefined);
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });
});

describe('CORS', () => {
    const [permitido] = config.corsOrigins;

    it('un Origin permitido recibe access-control-allow-origin', async () => {
        assert.ok(permitido, 'define CORS_ORIGINS en .env.test');
        const res = await api.get(RUTA).set('Origin', permitido);
        assert.equal(res.headers['access-control-allow-origin'], permitido);
    });

    it('un Origin no permitido no lo recibe', async () => {
        const res = await api.get(RUTA).set('Origin', 'http://malicioso.com');
        assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
});
