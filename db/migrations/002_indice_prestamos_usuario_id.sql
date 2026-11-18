-- 002: índice compuesto (usuario_id, id) en prestamos
--
-- Sirve para listar los préstamos de un usuario con paginación por cursor
-- (WHERE usuario_id = $1 AND id < $cursor ORDER BY id DESC LIMIT n): Postgres
-- encuentra el usuario y recorre sus préstamos ya ordenados por id (el índice
-- se lee hacia atrás), sin ordenar en memoria.

-- Primero se crea el índice nuevo, para que nunca falte un índice sobre la FK
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_id_id ON prestamos (usuario_id, id);

-- El índice viejo sobra: como usuario_id es la primera columna del compuesto,
-- este ya cubre las búsquedas por usuario_id (incluida la FK)
DROP INDEX IF EXISTS idx_prestamos_usuario_id;
