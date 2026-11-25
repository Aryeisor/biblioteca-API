import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import type { EntradaAuditoria } from '../src/types/dominio.js';
import { api, crearUsuarioConToken, limpiarTablas, cerrarPool } from './helpers.js';

before(limpiarTablas);
after(cerrarPool);

const PASSWORD = 'clave12345';
let contador = 0;
const correo = () => `auditoria${++contador}@correo.com`;

const entradas = async (accion: string): Promise<EntradaAuditoria[]> => {
    const { rows } = await pool.query<EntradaAuditoria>(
        'SELECT * FROM audit_log WHERE accion = $1 ORDER BY id',
        [accion],
    );
    return rows;
};

const registrar = async (email: string) => {
    const res = await api
        .post('/auth/registrar')
        .send({ nombre: 'Auditado', email, password: PASSWORD })
        .expect(201);
    return res.body.id as number;
};

describe('Auditoría de autenticación', () => {
    it('registrar deja una entrada con IP y el X-Request-Id de la petición', async () => {
        const email = correo();
        const res = await api
            .post('/auth/registrar')
            .set('X-Request-Id', 'prueba-registro-1')
            .send({ nombre: 'Auditado', email, password: PASSWORD })
            .expect(201);

        const entrada = (await entradas('registro')).find((e) => e.actor_id === res.body.id);
        assert.ok(entrada);
        assert.equal(entrada.objetivo_id, res.body.id);
        assert.equal(entrada.request_id, 'prueba-registro-1');
        assert.ok(entrada.ip);
    });

    it('login exitoso queda registrado', async () => {
        const email = correo();
        const id = await registrar(email);
        await api.post('/auth/login').send({ email, password: PASSWORD }).expect(200);

        const entrada = (await entradas('login_exitoso')).find((e) => e.actor_id === id);
        assert.ok(entrada);
    });

    it('login con contraseña incorrecta: registra al usuario objetivo, sin guardar email ni contraseña', async () => {
        const email = correo();
        const id = await registrar(email);
        const intento = 'contraseña-secreta-equivocada';
        await api.post('/auth/login').send({ email, password: intento }).expect(401);

        const entrada = (await entradas('login_fallido')).find((e) => e.objetivo_id === id);
        assert.ok(entrada);
        assert.equal(entrada.actor_id, null);
        assert.equal(entrada.detalle.motivo, 'password_incorrecta');
        assert.match(String(entrada.detalle.email_huella), /^[0-9a-f]{16}$/);
        const crudo = JSON.stringify(entrada);
        assert.equal(crudo.includes(email), false);
        assert.equal(crudo.includes(intento), false);
    });

    it('login con un email que no existe: queda registrado sin objetivo', async () => {
        await api
            .post('/auth/login')
            .send({ email: 'fantasma@correo.com', password: PASSWORD })
            .expect(401);

        const entrada = (await entradas('login_fallido')).find(
            (e) => e.detalle.motivo === 'usuario_inexistente',
        );
        assert.ok(entrada);
        assert.equal(entrada.objetivo_id, null);
    });
});

describe('Auditoría de sesiones', () => {
    it('logout y logout-todo quedan registrados', async () => {
        const email = correo();
        const id = await registrar(email);
        const login = await api.post('/auth/login').send({ email, password: PASSWORD });
        const cookie = String(login.headers['set-cookie']?.[0]).split(';')[0] ?? '';

        await api.post('/auth/logout').set('Cookie', cookie).expect(204);
        await api
            .post('/auth/logout-todo')
            .set('Authorization', `Bearer ${login.body.token}`)
            .expect(204);

        assert.ok((await entradas('logout')).some((e) => e.actor_id === id));
        assert.ok((await entradas('logout_todo')).some((e) => e.actor_id === id));
    });

    it('la reutilización de un refresh token queda registrada con la familia', async () => {
        const email = correo();
        const id = await registrar(email);
        const login = await api.post('/auth/login').send({ email, password: PASSWORD });
        const cookieVieja = String(login.headers['set-cookie']?.[0]).split(';')[0] ?? '';
        await api.post('/auth/refresh').set('Cookie', cookieVieja).expect(200);
        await pool.query(
            "UPDATE refresh_tokens SET usado_en = NOW() - INTERVAL '1 minute' WHERE usuario_id = $1 AND usado_en IS NOT NULL",
            [id],
        );

        await api.post('/auth/refresh').set('Cookie', cookieVieja).expect(401);

        const entrada = (await entradas('refresh_reuso_detectado')).find(
            (e) => e.objetivo_id === id,
        );
        assert.ok(entrada);
        assert.match(String(entrada.detalle.familia_id), /^[0-9a-f-]{36}$/);
    });
});

describe('Auditoría de cambios de usuarios', () => {
    it('cambiar el rol registra quién, a quién y de qué a qué', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const lector = await crearUsuarioConToken('Lector', correo(), PASSWORD);

        await api
            .patch(`/usuarios/${lector.id}/rol`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ rol: 'bibliotecario' })
            .expect(200);

        const entrada = (await entradas('rol_cambiado')).find((e) => e.objetivo_id === lector.id);
        assert.ok(entrada);
        assert.equal(entrada.actor_id, admin.id);
        assert.deepEqual(entrada.detalle, { de: 'lector', a: 'bibliotecario' });
    });

    it('la respuesta de cambiar el rol no expone el rol anterior', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const lector = await crearUsuarioConToken('Lector', correo(), PASSWORD);

        const res = await api
            .patch(`/usuarios/${lector.id}/rol`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ rol: 'bibliotecario' });

        assert.equal(res.body.rol, 'bibliotecario');
        assert.equal('rol_anterior' in res.body, false);
    });

    it('asignar el mismo rol que ya tenía no genera ruido', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const lector = await crearUsuarioConToken('Lector', correo(), PASSWORD);

        await api
            .patch(`/usuarios/${lector.id}/rol`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ rol: 'lector' })
            .expect(200);

        const entrada = (await entradas('rol_cambiado')).find((e) => e.objetivo_id === lector.id);
        assert.equal(entrada, undefined);
    });

    it('un cambio rechazado no deja entrada', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');

        await api
            .patch(`/usuarios/${admin.id}/rol`)
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ rol: 'lector' })
            .expect(400);

        const entrada = (await entradas('rol_cambiado')).find((e) => e.objetivo_id === admin.id);
        assert.equal(entrada, undefined);
    });

    it('eliminar un usuario queda registrado y no guarda su email', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const email = correo();
        const lector = await crearUsuarioConToken('Lector', email, PASSWORD);

        await api
            .delete(`/usuarios/${lector.id}`)
            .set('Authorization', `Bearer ${admin.token}`)
            .expect(204);

        const entrada = (await entradas('usuario_eliminado')).find(
            (e) => e.objetivo_id === lector.id,
        );
        assert.ok(entrada);
        assert.equal(entrada.actor_id, admin.id);
        assert.equal(JSON.stringify(entrada).includes(email), false);
    });

    it('si el borrado falla, no queda entrada (misma transacción)', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const lector = await crearUsuarioConToken('Lector', correo(), PASSWORD);
        const { rows } = await pool.query<{ id: number }>(
            "INSERT INTO autores (nombre) VALUES ('A') RETURNING id",
        );
        const libro = await pool.query<{ id: number }>(
            "INSERT INTO libros (titulo, autor_id, stock) VALUES ('L', $1, 1) RETURNING id",
            [rows[0]?.id],
        );
        // un préstamo impide borrar al usuario (ON DELETE RESTRICT)
        await pool.query('INSERT INTO prestamos (libro_id, usuario_id) VALUES ($1, $2)', [
            libro.rows[0]?.id,
            lector.id,
        ]);

        const res = await api
            .delete(`/usuarios/${lector.id}`)
            .set('Authorization', `Bearer ${admin.token}`);

        assert.equal(res.status, 409);
        const entrada = (await entradas('usuario_eliminado')).find(
            (e) => e.objetivo_id === lector.id,
        );
        assert.equal(entrada, undefined);
    });
});

describe('La tabla es de solo escritura', () => {
    it('no permite UPDATE ni DELETE', async () => {
        await registrar(correo());
        await assert.rejects(pool.query("UPDATE audit_log SET accion = 'otra'"), /solo escritura/);
        await assert.rejects(pool.query('DELETE FROM audit_log'), /solo escritura/);
    });
});

describe('GET /auditoria', () => {
    it('exige token y rol admin', async () => {
        assert.equal((await api.get('/auditoria')).status, 401);

        const lector = await crearUsuarioConToken('L', correo(), PASSWORD);
        const biblio = await crearUsuarioConToken('B', correo(), PASSWORD, 'bibliotecario');
        for (const sesion of [lector, biblio]) {
            const res = await api.get('/auditoria').set('Authorization', `Bearer ${sesion.token}`);
            assert.equal(res.status, 403);
            assert.equal(res.body.code, 'PERMISO_DENEGADO');
        }
    });

    it('el admin lista las entradas, las más recientes primero', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const res = await api.get('/auditoria').set('Authorization', `Bearer ${admin.token}`);

        assert.equal(res.status, 200);
        assert.ok(res.body.data.length > 0);
        const ids = (res.body.data as { id: number }[]).map((e) => e.id);
        assert.deepEqual(
            ids,
            [...ids].sort((a, b) => b - a),
        );
    });

    it('filtra por acción y por actor', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const auth = `Bearer ${admin.token}`;

        const porAccion = await api
            .get('/auditoria?accion=login_exitoso')
            .set('Authorization', auth);
        assert.ok(porAccion.body.data.length > 0);
        for (const e of porAccion.body.data as { accion: string }[]) {
            assert.equal(e.accion, 'login_exitoso');
        }

        const porActor = await api.get(`/auditoria?actorId=${admin.id}`).set('Authorization', auth);
        assert.ok(porActor.body.data.length > 0);
        for (const e of porActor.body.data as { actor_id: number }[]) {
            assert.equal(e.actor_id, admin.id);
        }
    });

    it('pagina con cursor sin repetir ni saltar entradas', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const auth = `Bearer ${admin.token}`;

        const primera = await api.get('/auditoria?limite=2').set('Authorization', auth);
        assert.equal(primera.body.data.length, 2);
        assert.ok(primera.body.paginacion.siguienteCursor);

        const segunda = await api
            .get(`/auditoria?limite=2&cursor=${primera.body.paginacion.siguienteCursor}`)
            .set('Authorization', auth);
        const vistos = [...primera.body.data, ...segunda.body.data].map(
            (e: { id: number }) => e.id,
        );
        assert.equal(new Set(vistos).size, vistos.length);
        assert.ok(
            Math.max(...segunda.body.data.map((e: { id: number }) => e.id)) <
                Math.min(...primera.body.data.map((e: { id: number }) => e.id)),
        );
    });

    it('rechaza filtros inválidos con 400', async () => {
        const admin = await crearUsuarioConToken('Admin', correo(), PASSWORD, 'admin');
        const auth = `Bearer ${admin.token}`;

        assert.equal(
            (await api.get('/auditoria?accion=inventada').set('Authorization', auth)).status,
            400,
        );
        assert.equal(
            (await api.get('/auditoria?actorId=abc').set('Authorization', auth)).status,
            400,
        );
        assert.equal((await api.get('/auditoria?limite=0').set('Authorization', auth)).status, 400);
        assert.equal(
            (await api.get('/auditoria?cursor=basura').set('Authorization', auth)).status,
            400,
        );
    });
});
