-- Campos del Excel maestro: Nº trámite DNI, clave fiscal AFIP, fecha de alta AFIP
ALTER TABLE choferes
  ADD COLUMN IF NOT EXISTS nro_tramite_dni text,
  ADD COLUMN IF NOT EXISTS clave_fiscal     text,
  ADD COLUMN IF NOT EXISTS alta_afip        date;
