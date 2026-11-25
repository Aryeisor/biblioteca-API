import type { PoolClient } from 'pg';
import type { FilaRefreshToken } from '../types/dominio.js';

// Todas reciben el client de una transacción: rotar un token son varios pasos que deben ir juntos.

export const crear = async (
    client: PoolClient,
    usuarioId: number,
    familiaId: string,
    tokenHash: string,
    diasDeVida: number,
): Promise<void> => {
    await client.query(
        `INSERT INTO refresh_tokens (usuario_id, familia_id, token_hash, expira_en)
         VALUES ($1, $2, $3, NOW() + make_interval(days => $4))`,
        [usuarioId, familiaId, tokenHash, diasDeVida],
    );
};

// FOR UPDATE: dos refresh simultáneos con el mismo token se ponen en fila. El segundo ve el token
// ya usado en vez de crear dos sucesores. Las comparaciones de fecha se hacen en SQL (con el reloj
// de la base) y llegan como booleanos.
export const buscarPorHashBloqueando = async (
    client: PoolClient,
    tokenHash: string,
    segundosDeGracia: number,
): Promise<FilaRefreshToken | undefined> => {
    const { rows } = await client.query<FilaRefreshToken>(
        `SELECT id, usuario_id, familia_id,
                expira_en <= NOW() AS vencido,
                revocado_en IS NOT NULL AS revocado,
                usado_en IS NOT NULL AS usado,
                COALESCE(usado_en > NOW() - make_interval(secs => $2), FALSE) AS en_gracia
         FROM refresh_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash, segundosDeGracia],
    );
    return rows[0];
};

export const marcarUsado = async (client: PoolClient, id: number): Promise<void> => {
    await client.query('UPDATE refresh_tokens SET usado_en = NOW() WHERE id = $1', [id]);
};

export const revocarFamilia = async (client: PoolClient, familiaId: string): Promise<void> => {
    await client.query(
        'UPDATE refresh_tokens SET revocado_en = NOW() WHERE familia_id = $1 AND revocado_en IS NULL',
        [familiaId],
    );
};

export const revocarTodosDelUsuario = async (
    client: PoolClient,
    usuarioId: number,
): Promise<void> => {
    await client.query(
        'UPDATE refresh_tokens SET revocado_en = NOW() WHERE usuario_id = $1 AND revocado_en IS NULL',
        [usuarioId],
    );
};

// Limpieza oportunista: al iniciar sesión se borran los vencidos de ese usuario (usa el índice por usuario)
export const borrarVencidos = async (client: PoolClient, usuarioId: number): Promise<void> => {
    await client.query('DELETE FROM refresh_tokens WHERE usuario_id = $1 AND expira_en <= NOW()', [
        usuarioId,
    ]);
};
