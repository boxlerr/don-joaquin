-- Material del viaje como columna propia.
--
-- Hasta ahora el material vivía embebido en `observaciones` con el formato
-- "Material: X · ..." y se extraía por regex en cada lectura (getViajesAction,
-- hoja de ruta, etc.). Eso lo hacía invisible para la carga manual y frágil
-- (dependía del texto exacto). Lo promovemos a columna:
--   - editable desde la carga/edición manual de viajes
--   - escrito directamente por los importadores (Loma Negra / hoja de ruta)
--   - leído sin regex
--
-- Backfill desde la marca que dejaron los importadores en observaciones.

alter table public.viajes
  add column if not exists material text;

comment on column public.viajes.material is
  'Material transportado (ej: Cemento, Clinker, Arena). Antes se extraía por regex de observaciones.';

update public.viajes
  set material = trim(substring(observaciones from 'Material:\s*([^·|]+)'))
  where material is null
    and observaciones ~* 'Material:\s*[^·|]+';
