-- 003: un usuario no puede tener dos préstamos activos del mismo libro
--
-- Índice único PARCIAL: solo aplica a las filas con fecha_devolucion IS NULL
-- (préstamos activos). Así el historial puede repetir la pareja libro-usuario
-- todas las veces que quiera, pero activa solo puede haber una.
--
-- El ejecutor de migraciones (src/migraciones) ya corre cada archivo dentro de una
-- transacción: si el índice falla, la limpieza se deshace. Por eso no lleva BEGIN/COMMIT.

-- 1) Limpieza: si ya hay datos que violan la regla, el CREATE UNIQUE INDEX
--    falla con 23505. Se cierran los duplicados dejando activo solo el más
--    reciente de cada pareja (ROW_NUMBER = 1), y a cada libro se le devuelve
--    el stock de los préstamos cerrados, igual que hace una devolución normal.
WITH duplicados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY libro_id, usuario_id
                            ORDER BY fecha_prestamo DESC, id DESC) AS n
  FROM prestamos
  WHERE fecha_devolucion IS NULL          -- la misma condición del índice
),
cerrados AS (
  UPDATE prestamos p
  SET fecha_devolucion = NOW()            -- cumple el CHECK fecha_devolucion >= fecha_prestamo
  FROM duplicados d
  WHERE p.id = d.id AND d.n > 1
  RETURNING p.libro_id
)
UPDATE libros l
SET stock = l.stock + c.cantidad
FROM (SELECT libro_id, COUNT(*) AS cantidad FROM cerrados GROUP BY libro_id) c
WHERE l.id = c.libro_id;

-- 2) La regla. La API traduce su violación (err.constraint) a 409 PRESTAMO_DUPLICADO
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestamo_activo
  ON prestamos (libro_id, usuario_id)
  WHERE fecha_devolucion IS NULL;
