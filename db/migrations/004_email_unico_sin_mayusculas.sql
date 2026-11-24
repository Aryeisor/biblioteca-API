-- El email se guarda en minúsculas desde la API, pero la base de datos no lo sabía:
-- un INSERT directo (script, otro servicio) podía crear "Ana@x.com" junto a "ana@x.com".
-- Este índice hace que la propia base lo impida.

-- Si ya existen duplicados que solo difieren en mayúsculas, el índice no se puede crear.
-- Decidir cuál cuenta es la buena es una decisión de negocio: falla con un mensaje claro y no borra nada.
DO $$
DECLARE
    repetidos TEXT;
BEGIN
    SELECT string_agg(correo, ', ') INTO repetidos
    FROM (
        SELECT lower(email) AS correo
        FROM usuarios
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
    ) d;

    IF repetidos IS NOT NULL THEN
        RAISE EXCEPTION 'Hay emails repetidos que solo difieren en mayúsculas: %. Fusiónalos o elimina uno a mano antes de migrar.', repetidos;
    END IF;
END $$;

CREATE UNIQUE INDEX uq_usuarios_email_lower ON usuarios (lower(email));
