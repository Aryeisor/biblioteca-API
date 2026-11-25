-- Sesiones de larga duración. El token que recibe el cliente es aleatorio y opaco; aquí solo se
-- guarda su huella SHA-256: si alguien lee esta tabla (un backup, una inyección SQL), no puede
-- usar los tokens, igual que con las contraseñas.
--
-- Cada login abre una "familia". Cada refresh marca el token usado y crea uno nuevo de la misma
-- familia (rotación). Si un token ya usado se presenta otra vez, alguien lo copió: se revoca la
-- familia entera y hay que volver a iniciar sesión.

CREATE TABLE refresh_tokens (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    familia_id  UUID NOT NULL,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en   TIMESTAMPTZ NOT NULL,
    usado_en    TIMESTAMPTZ,  -- NULL = aún no se ha rotado
    revocado_en TIMESTAMPTZ   -- NULL = vigente
);

-- Borrar o buscar por usuario (logout-todo, limpieza de vencidos) y por familia (revocación)
CREATE INDEX idx_refresh_tokens_usuario_id ON refresh_tokens (usuario_id);
CREATE INDEX idx_refresh_tokens_familia_id ON refresh_tokens (familia_id);
