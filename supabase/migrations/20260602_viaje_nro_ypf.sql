-- Agrega el número de viaje asignado por YPF (u otro dador de carga).
-- Campo opcional: no todos los viajes son de YPF.
-- Sin unicidad por ahora: el flujo real de cómo llega ese número aún no está confirmado
-- con logística. Si se confirma que es único por dador de carga, agregar constraint después.

ALTER TABLE public.viajes
  ADD COLUMN IF NOT EXISTS nro_viaje_ypf text;

-- Índice parcial: solo indexa filas que tienen el campo cargado.
CREATE INDEX IF NOT EXISTS viajes_nro_viaje_ypf_idx
  ON public.viajes (nro_viaje_ypf)
  WHERE nro_viaje_ypf IS NOT NULL;
