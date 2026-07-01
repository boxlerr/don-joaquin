-- Score de choferes (planilla de Bárbara) — sumar al puntaje las MULTAS de tránsito
-- (Seguridad) y los ADELANTOS de sueldo + LLAMADOS de atención (Conducta laboral).
-- ---------------------------------------------------------------------------
-- Hoy el score solo contaba: Seguridad = apercibimientos, Conducta = ausencias
-- injustificadas. La planilla también incluye multas/adelantos/llamados, que no se
-- cargaban en ningún lado. Se modelan como eventos por chofer en la tabla que ya
-- existe (chofer_apercibimientos), distinguidos por un nuevo campo `tipo`.
--
-- Mapeo al score:
--   Seguridad = tipo ∈ (apercibimiento, multa)
--   Conducta  = ausencias injustificadas + tipo ∈ (llamado_atencion, adelanto)
--
-- Idempotente. `default 'apercibimiento'` → las filas existentes NO cambian de
-- significado (siguen contando como apercibimientos en Seguridad).

alter table public.chofer_apercibimientos
  add column if not exists tipo text not null default 'apercibimiento';

alter table public.chofer_apercibimientos
  drop constraint if exists chofer_apercibimientos_tipo_check;
alter table public.chofer_apercibimientos
  add constraint chofer_apercibimientos_tipo_check
  check (tipo in ('apercibimiento', 'multa', 'llamado_atencion', 'adelanto'));

create index if not exists chofer_apercibimientos_tipo_idx
  on public.chofer_apercibimientos (tipo);

comment on column public.chofer_apercibimientos.tipo is
  'Tipo de evento para el score: apercibimiento/multa → Seguridad; llamado_atencion/adelanto → Conducta laboral.';
