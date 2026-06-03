-- Fin del período de prueba (6 meses desde el alta AFIP / ingreso).
-- La columna ya existía en la DB compartida pero faltaba el archivo de migración;
-- se agrega idempotente para que el esquema sea reproducible en otros entornos.
ALTER TABLE public.choferes
  ADD COLUMN IF NOT EXISTS periodo_prueba_fin date;
