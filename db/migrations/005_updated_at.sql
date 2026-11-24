-- updated_at: cuándo cambió por última vez cada fila.
-- Lo mantiene un trigger (no la aplicación) para que ningún UPDATE se salte la regla,
-- ya venga de la API, de un script o de pgAdmin.

CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Las filas existentes quedan con la fecha de esta migración (no se puede saber la real).
ALTER TABLE autores  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE libros   ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE usuarios ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_autores_updated_at
    BEFORE UPDATE ON autores
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_libros_updated_at
    BEFORE UPDATE ON libros
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
