import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Response } from 'supertest';
import pool from '../src/config/db.js';
import { api, limpiarTablas, cerrarPool } from './helpers.js';

before(limpiarTablas);
after(cerrarPool);

const PASSWORD = 'clave12345';
let contador = 0;

// Registra un usuario con email único y devuelve su login
const nuevoUsuario = async () => {
    const email = `sesion${++contador}@correo.com`;
    const { body } = await api
        .post('/auth/registrar')
        .send({ nombre: 'Sesion', email, password: PASSWORD })
        .expect(201);
    return { id: body.id as number, email };
};

const iniciarSesion = (email: string) =>
    api.post('/auth/login').send({ email, password: PASSWORD });

// "refresh_token=abc; Path=/auth; HttpOnly; ..." → la línea completa del Set-Cookie
const setCookieRefresh = (res: Response): string => {
    const cabecera = res.headers['set-cookie'];
    const lista: string[] = Array.isArray(cabecera) ? cabecera : [];
    const linea = lista.find((c) => c.startsWith('refresh_token='));
    assert.ok(linea, 'la respuesta debería traer la cookie refresh_token');
    return linea;
};

// Solo "refresh_token=abc": lo que el navegador reenvía en el header Cookie
const cookieParaEnviar = (res: Response): string => setCookieRefresh(res).split(';')[0] ?? '';

const refrescar = (cookie: string) => api.post('/auth/refresh').set('Cookie', cookie);

const huella = (cookie: string): string =>
    createHash('sha256').update(cookie.replace('refresh_token=', '')).digest('hex');

describe('Login y cookie del refresh token', () => {
    it('devuelve el access token en el body y el refresh token solo en una cookie segura', async () => {
        const { email } = await nuevoUsuario();
        const res = await iniciarSesion(email);

        assert.equal(res.status, 200);
        assert.ok(res.body.token);
        assert.equal('refreshToken' in res.body, false);

        const cookie = setCookieRefresh(res);
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.match(cookie, /Path=\/auth(;|$)/i);
        assert.match(cookie, /Max-Age=\d+/i);
    });

    it('en la base solo se guarda la huella, nunca el token', async () => {
        const { email, id } = await nuevoUsuario();
        const res = await iniciarSesion(email);
        const cookie = cookieParaEnviar(res);

        const { rows } = await pool.query<{ token_hash: string }>(
            'SELECT token_hash FROM refresh_tokens WHERE usuario_id = $1',
            [id],
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.token_hash, huella(cookie));
        assert.equal(cookie.includes(rows[0]?.token_hash ?? 'x'), false);
    });
});

describe('POST /auth/refresh', () => {
    it('rota: devuelve un access token nuevo y una cookie distinta', async () => {
        const { email } = await nuevoUsuario();
        const login = await iniciarSesion(email);
        const cookieVieja = cookieParaEnviar(login);

        const res = await refrescar(cookieVieja);

        assert.equal(res.status, 200);
        assert.ok(res.body.token);
        assert.notEqual(cookieParaEnviar(res), cookieVieja);
        // el access token nuevo sirve
        await api.get('/prestamos').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    });

    it('sin cookie o con una cookie mal formada responde 401 SESION_INVALIDA', async () => {
        const sinCookie = await api.post('/auth/refresh');
        assert.equal(sinCookie.status, 401);
        assert.equal(sinCookie.body.code, 'SESION_INVALIDA');

        const malFormada = await refrescar('refresh_token=esto-no-es-un-token');
        assert.equal(malFormada.status, 401);
        assert.equal(malFormada.body.code, 'SESION_INVALIDA');
    });

    it('con un token que no existe responde 401 y borra la cookie', async () => {
        const res = await refrescar(`refresh_token=${'a'.repeat(43)}`);
        assert.equal(res.status, 401);
        assert.match(setCookieRefresh(res), /refresh_token=;/);
    });

    it('un token vencido responde 401', async () => {
        const { email, id } = await nuevoUsuario();
        const cookie = cookieParaEnviar(await iniciarSesion(email));
        await pool.query(
            "UPDATE refresh_tokens SET expira_en = NOW() - INTERVAL '1 second' WHERE usuario_id = $1",
            [id],
        );
        assert.equal((await refrescar(cookie)).status, 401);
    });

    it('vuelve a leer el rol: un cambio de rol llega con el siguiente refresh', async () => {
        const { email, id } = await nuevoUsuario();
        const cookie = cookieParaEnviar(await iniciarSesion(email));
        await pool.query("UPDATE usuarios SET rol = 'admin' WHERE id = $1", [id]);

        const res = await refrescar(cookie);

        const payload = jwt.decode(res.body.token);
        assert.ok(payload && typeof payload === 'object');
        assert.equal(payload.rol, 'admin');
    });

    it('si el usuario se elimina, su sesión deja de valer', async () => {
        const { email, id } = await nuevoUsuario();
        const cookie = cookieParaEnviar(await iniciarSesion(email));
        await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        assert.equal((await refrescar(cookie)).status, 401);
    });
});

describe('Reutilización de un refresh token (robo)', () => {
    it('dentro de los 10 s de gracia responde 409 y no revoca la sesión legítima', async () => {
        const { email } = await nuevoUsuario();
        const cookieVieja = cookieParaEnviar(await iniciarSesion(email));
        const rotada = await refrescar(cookieVieja);

        const repetida = await refrescar(cookieVieja);
        assert.equal(repetida.status, 409);
        assert.equal(repetida.body.code, 'REFRESH_EN_CURSO');
        // no borra la cookie: pisaría la nueva que acaba de guardar la otra petición
        const cabecera = repetida.headers['set-cookie'];
        assert.equal(Array.isArray(cabecera) ? cabecera.length : 0, 0);

        // el token nuevo sigue vivo
        assert.equal((await refrescar(cookieParaEnviar(rotada))).status, 200);
    });

    it('pasada la gracia revoca TODA la familia, incluido el token nuevo', async () => {
        const { email, id } = await nuevoUsuario();
        const cookieVieja = cookieParaEnviar(await iniciarSesion(email));
        const rotada = await refrescar(cookieVieja);
        const cookieNueva = cookieParaEnviar(rotada);

        // como si el token viejo se hubiera usado hace un minuto
        await pool.query(
            "UPDATE refresh_tokens SET usado_en = NOW() - INTERVAL '1 minute' WHERE usuario_id = $1 AND usado_en IS NOT NULL",
            [id],
        );

        const ladron = await refrescar(cookieVieja);
        assert.equal(ladron.status, 401);

        // el dueño legítimo también queda fuera: tiene que volver a iniciar sesión
        assert.equal((await refrescar(cookieNueva)).status, 401);
    });

    it('dos refresh simultáneos con el mismo token: uno gana y el otro recibe 409', async () => {
        const { email } = await nuevoUsuario();
        const cookie = cookieParaEnviar(await iniciarSesion(email));

        const respuestas = await Promise.all([refrescar(cookie), refrescar(cookie)]);

        const estados = respuestas.map((r) => r.status).sort();
        assert.deepEqual(estados, [200, 409]);
    });

    it('otra sesión del mismo usuario no se ve afectada', async () => {
        const { email, id } = await nuevoUsuario();
        const cookieA = cookieParaEnviar(await iniciarSesion(email));
        const cookieB = cookieParaEnviar(await iniciarSesion(email));

        await refrescar(cookieA);
        await pool.query(
            "UPDATE refresh_tokens SET usado_en = NOW() - INTERVAL '1 minute' WHERE usuario_id = $1 AND usado_en IS NOT NULL",
            [id],
        );
        assert.equal((await refrescar(cookieA)).status, 401); // reuso en la familia A

        assert.equal((await refrescar(cookieB)).status, 200); // la familia B sigue
    });
});

describe('Cerrar sesión', () => {
    it('logout: 204, borra la cookie y el token ya no sirve', async () => {
        const { email } = await nuevoUsuario();
        const cookie = cookieParaEnviar(await iniciarSesion(email));

        const res = await api.post('/auth/logout').set('Cookie', cookie);

        assert.equal(res.status, 204);
        assert.match(setCookieRefresh(res), /refresh_token=;/);
        assert.equal((await refrescar(cookie)).status, 401);
    });

    it('logout sin sesión también responde 204', async () => {
        assert.equal((await api.post('/auth/logout')).status, 204);
    });

    it('logout-todo cierra todas las sesiones del usuario y exige estar autenticado', async () => {
        const { email } = await nuevoUsuario();
        const a = await iniciarSesion(email);
        const b = await iniciarSesion(email);

        assert.equal((await api.post('/auth/logout-todo')).status, 401);

        const res = await api
            .post('/auth/logout-todo')
            .set('Authorization', `Bearer ${a.body.token}`);
        assert.equal(res.status, 204);

        assert.equal((await refrescar(cookieParaEnviar(a))).status, 401);
        assert.equal((await refrescar(cookieParaEnviar(b))).status, 401);
    });
});
