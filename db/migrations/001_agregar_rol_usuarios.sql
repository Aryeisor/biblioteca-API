ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'lector'
    CHECK (rol IN ('lector', 'bibliotecario', 'admin'));