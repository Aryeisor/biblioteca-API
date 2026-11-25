import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import * as repo from '../repositories/refresh_tokens_repositories.js';
import * as usuariosrepo from '../repositories/usuarios_repositories.js';
import { registrarEn } from './auditoria_services.js';
import type { ContextoAuditoria, Rol } from '../types/dominio.js';
import { AppError } from '../utils/AppError.js';
import { enTransaccion } from '../utils/transaccion.js';

// Si un token ya usado vuelve a presentarse dentro de este plazo, se asume una carrera legítima
// (dos pestañas renovando a la vez) y NO se trata como robo. Pasado el plazo, sí.
const SEGUNDOS_DE_GRACIA = 10;

// 32 bytes aleatorios en base64url = 43 caracteres. Cualquier otra forma se rechaza sin tocar la base.
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

const huella = (token: string): string => createHash('sha256').update(token).digest('hex');
const generarToken = (): string => randomBytes(32).toString('base64url');

export type Sesion = { accessToken: string; refreshToken: string };

// sub debe ser texto (RFC 7519) y así lo declaran los tipos de jsonwebtoken
const firmarAccessToken = (id: number, rol: Rol): string =>
    jwt.sign({ sub: String(id), rol }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const sesionInvalida = () => new AppError(401, 'Sesión no válida', 'SESION_INVALIDA');

// Abre una familia nueva: lo que ocurre después de un login correcto
export const iniciarSesion = (usuario: { id: number; rol: Rol }): Promise<Sesion> =>
    enTransaccion(async (client) => {
        const refreshToken = generarToken();
        await repo.borrarVencidos(client, usuario.id);
        await repo.crear(
            client,
            usuario.id,
            randomUUID(),
            huella(refreshToken),
            config.refreshTokenDias,
        );
        return { accessToken: firmarAccessToken(usuario.id, usuario.rol), refreshToken };
    });

type ResultadoRotacion =
    | { tipo: 'ok'; sesion: Sesion }
    | { tipo: 'invalida' }
    | { tipo: 'carrera' }
    | { tipo: 'reuso'; usuarioId: number };

export const refrescar = async (
    tokenPlano: string | undefined,
    contexto: ContextoAuditoria,
): Promise<Sesion> => {
    if (!tokenPlano || !FORMATO_TOKEN.test(tokenPlano)) throw sesionInvalida();

    // La decisión se toma dentro de la transacción y el error se lanza FUERA: si se lanzara dentro,
    // el ROLLBACK deshacería la revocación de la familia justo cuando más hace falta.
    const resultado = await enTransaccion(async (client): Promise<ResultadoRotacion> => {
        const fila = await repo.buscarPorHashBloqueando(
            client,
            huella(tokenPlano),
            SEGUNDOS_DE_GRACIA,
        );
        if (!fila || fila.revocado || fila.vencido) return { tipo: 'invalida' };

        if (fila.usado) {
            if (fila.en_gracia) return { tipo: 'carrera' };
            await repo.revocarFamilia(client, fila.familia_id);
            // en la misma transacción: no puede quedar la familia revocada sin rastro del motivo
            await registrarEn(client, {
                accion: 'refresh_reuso_detectado',
                objetivoId: fila.usuario_id,
                detalle: { familia_id: fila.familia_id },
                contexto,
            });
            return { tipo: 'reuso', usuarioId: fila.usuario_id };
        }

        const usuario = await usuariosrepo.buscarRolPorId(client, fila.usuario_id);
        if (!usuario) return { tipo: 'invalida' };

        await repo.marcarUsado(client, fila.id);
        const refreshToken = generarToken();
        await repo.crear(
            client,
            usuario.id,
            fila.familia_id,
            huella(refreshToken),
            config.refreshTokenDias,
        );
        return {
            tipo: 'ok',
            sesion: { accessToken: firmarAccessToken(usuario.id, usuario.rol), refreshToken },
        };
    });

    switch (resultado.tipo) {
        case 'ok':
            return resultado.sesion;
        case 'carrera':
            // 409, no 401: el cliente no debe borrar su sesión; la otra petición ya trajo el token nuevo
            throw new AppError(409, 'La sesión se está renovando, reintenta', 'REFRESH_EN_CURSO');
        case 'reuso':
            logger.warn(
                { usuarioId: resultado.usuarioId },
                'refresh token reutilizado: se revocó toda la familia',
            );
            throw sesionInvalida();
        case 'invalida':
            throw sesionInvalida();
    }
};

// Cierra la sesión de este dispositivo (toda su familia). Sin token o con uno desconocido no hace
// nada: cerrar una sesión que ya no existe no es un error.
export const cerrarSesion = async (
    tokenPlano: string | undefined,
    contexto: ContextoAuditoria,
): Promise<void> => {
    if (!tokenPlano || !FORMATO_TOKEN.test(tokenPlano)) return;
    await enTransaccion(async (client) => {
        const fila = await repo.buscarPorHashBloqueando(client, huella(tokenPlano), 0);
        if (!fila) return;
        await repo.revocarFamilia(client, fila.familia_id);
        await registrarEn(client, {
            accion: 'logout',
            actorId: fila.usuario_id,
            objetivoId: fila.usuario_id,
            contexto,
        });
    });
};

// Cierra todas las sesiones del usuario (todos sus dispositivos)
export const cerrarTodasLasSesiones = (
    usuarioId: number,
    contexto: ContextoAuditoria,
): Promise<void> =>
    enTransaccion(async (client) => {
        await repo.revocarTodosDelUsuario(client, usuarioId);
        await registrarEn(client, {
            accion: 'logout_todo',
            actorId: usuarioId,
            objetivoId: usuarioId,
            contexto,
        });
    });
