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
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_id ON prestamos(usuario_id);