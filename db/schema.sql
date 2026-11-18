-- db/schema.sql

CREATE TABLE IF NOT EXISTS autores (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS libros (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo      VARCHAR(200) NOT NULL,
    isbn        VARCHAR(20) UNIQUE,
    autor_id    INT NOT NULL REFERENCES autores(id) ON DELETE RESTRICT,
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- al final, igual que la deja la migración 001
    rol         VARCHAR(20) NOT NULL DEFAULT 'lector'
                CHECK (rol IN ('lector', 'bibliotecario', 'admin'))
);

CREATE TABLE IF NOT EXISTS prestamos (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    libro_id          INT NOT NULL REFERENCES libros(id) ON DELETE RESTRICT,
    usuario_id        INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_prestamo    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_devolucion  TIMESTAMPTZ,  -- NULL = aún no devuelto
    CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)
);

-- PostgreSQL NO crea índices automáticos en las llaves foráneas
CREATE INDEX IF NOT EXISTS idx_libros_autor_id ON libros(autor_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_libro_id ON prestamos(libro_id);
-- compuesto (migración 002): cubre la FK usuario_id y la paginación por cursor sobre id
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_id_id ON prestamos(usuario_id, id);

-- migración 003: un solo préstamo activo por pareja libro-usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestamo_activo
  ON prestamos (libro_id, usuario_id)
  WHERE fecha_devolucion IS NULL;