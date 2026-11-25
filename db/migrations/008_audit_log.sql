-- Registro de auditoría: quién hizo qué, cuándo y desde dónde. Solo se escribe, nunca se cambia.
--
-- Decisiones:
-- * actor_id y objetivo_id NO tienen clave foránea: el registro debe sobrevivir cuando el usuario
--   se elimine (con ON DELETE CASCADE la evidencia desaparecería justo con quien la dejó; con
--   RESTRICT impediría borrar usuarios).
-- * id es INT (2.100 millones de eventos). Si algún día no alcanza, se cambia a BIGINT en una migración.
-- * detalle es JSONB con datos mínimos. Nunca contraseñas, tokens ni correos completos.

CREATE TABLE audit_log (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accion      VARCHAR(50) NOT NULL,
    actor_id    INT,          -- quién lo hizo (NULL = nadie autenticado, ej. un login fallido)
    objetivo_id INT,          -- sobre quién (ej. el usuario al que se le cambió el rol)
    ip          VARCHAR(45),
    request_id  VARCHAR(64),  -- el X-Request-Id de la petición: une este registro con los logs
    detalle     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Los listados filtran por actor o por acción y ordenan por id descendente
CREATE INDEX idx_audit_log_actor_id ON audit_log (actor_id, id DESC);
CREATE INDEX idx_audit_log_accion ON audit_log (accion, id DESC);
-- Para borrar por antigüedad cuando haya una política de retención
CREATE INDEX idx_audit_log_creado_en ON audit_log (creado_en);

-- Solo escritura: un UPDATE o DELETE falla, incluso si el código de la aplicación tuviera un error.
-- Límite: quien sea dueño de la tabla puede desactivar el trigger o hacer TRUNCATE. La defensa
-- completa en producción es que la API se conecte con un rol que solo tenga INSERT y SELECT.
CREATE FUNCTION audit_log_solo_escritura() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log es de solo escritura: no se permite %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_solo_escritura
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_solo_escritura();
