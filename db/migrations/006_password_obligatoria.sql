-- Todo usuario debe tener contraseña. La columna admitía NULL por usuarios antiguos
-- (creados antes de existir el login); esos usuarios no podían entrar y el código
-- tenía que tratar un caso que no debería existir.

-- Qué hacer con un usuario sin contraseña (borrarlo, pedirle que la restablezca) es una
-- decisión de negocio: si existe alguno, falla con un mensaje claro y no toca nada.
DO $$
DECLARE
    sin_password INT;
BEGIN
    SELECT COUNT(*) INTO sin_password FROM usuarios WHERE password IS NULL;

    IF sin_password > 0 THEN
        RAISE EXCEPTION 'Hay % usuario(s) sin contraseña. Asígnales una o elimínalos antes de migrar.', sin_password;
    END IF;
END $$;

ALTER TABLE usuarios ALTER COLUMN password SET NOT NULL;
