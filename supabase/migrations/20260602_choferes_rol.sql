-- Distingue el tipo de personal: chofer de ruta, administrativo o mantenimiento.
-- Afecta la lógica de alertas: aniversarios de adm/mant disparan todos los años.
ALTER TABLE choferes
  ADD COLUMN IF NOT EXISTS rol text DEFAULT 'chofer'
  CHECK (rol IN ('chofer', 'administrativo', 'mantenimiento'));
