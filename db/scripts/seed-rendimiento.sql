-- Genera volumen para pruebas de rendimiento (EXPLAIN ANALYZE).
-- ⚠️ Solo en bases de desarrollo o de prueba. Nunca en producción.
-- Se borra solo al correr npm test (limpiarTablas hace TRUNCATE).

-- 2.000 usuarios, 500 libros, 300.000 préstamos (todos marcados con "seed" para poder borrarlos)
INSERT INTO usuarios (nombre, email, password)
SELECT 'Seed ' || g, 'seed' || g || '@seed.com', NULL
FROM generate_series(1, 2000) g;

INSERT INTO autores (nombre) VALUES ('Autor Seed');

INSERT INTO libros (titulo, autor_id, stock)
SELECT 'Libro Seed ' || g, (SELECT id FROM autores WHERE nombre = 'Autor Seed'), 1000
FROM generate_series(1, 500) g;

INSERT INTO prestamos (libro_id, usuario_id, fecha_prestamo, fecha_devolucion)
SELECT
  (SELECT min(id) FROM libros WHERE titulo LIKE 'Libro Seed%') + (random() * 499)::int,
  (SELECT min(id) FROM usuarios WHERE email LIKE 'seed%') + (random() * 1999)::int,
  NOW() - (g || ' minutes')::interval,
  CASE WHEN random() < 0.9 THEN NOW() - (g || ' minutes')::interval + interval '7 days' END
FROM generate_series(1, 300000) g;

ANALYZE;   -- actualiza las estadísticas que usa el planificador

--toma el id de un usuario
SELECT id FROM usuarios WHERE email = 'seed42@seed.com';

--mide la consulta exacta que hace la API
--Cambia el ID por el id que de la consulta anterior.
EXPLAIN ANALYZE
SELECT p.id, p.fecha_prestamo, p.fecha_devolucion, p.libro_id, l.titulo, p.usuario_id, u.nombre
FROM prestamos p
JOIN libros l ON l.id = p.libro_id
JOIN usuarios u ON u.id = p.usuario_id
WHERE p.usuario_id = ID
ORDER BY p.id DESC
LIMIT 21;