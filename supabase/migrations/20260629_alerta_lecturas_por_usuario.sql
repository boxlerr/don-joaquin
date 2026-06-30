-- Notificaciones por usuario: estado leido/descartado individual.
-- alertas.estado se mantiene como ciclo de vida GLOBAL (lo usa el dedup de
-- generarAlertas via .or('estado.eq.pendiente,fecha_vencimiento.gte.<hoy>')) y
-- NO se muta al marcar leida. Modelo: "no leida" = no hay fila (o leida_en NULL).
-- Asi cada usuario nuevo y cada alerta nueva aparece pendiente para todos sin back-fill.

create table if not exists public.alerta_lecturas (
  alerta_id     uuid not null references public.alertas(id)  on delete cascade,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  leida_en      timestamptz,   -- null = no leida todavia
  descartada_en timestamptz,   -- not null = borrada del historial por este usuario
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (alerta_id, usuario_id)
);

comment on table public.alerta_lecturas is
  'Estado leido/descartado de cada alerta POR usuario. Ausencia de fila o leida_en NULL = no leida. alertas.estado sigue siendo global (dedup del generador).';

-- Acceso por usuario (conteos del layout/poll, listado de pendientes/historial).
create index if not exists idx_alerta_lecturas_usuario
  on public.alerta_lecturas (usuario_id);

-- Acelera el anti-join "de estas N alertas globales, cuales oculto el user".
-- Parcial para mantenerlo chico (solo filas ya marcadas).
create index if not exists idx_alerta_lecturas_usuario_marcadas
  on public.alerta_lecturas (usuario_id, alerta_id)
  where leida_en is not null or descartada_en is not null;

-- updated_at automatico en cada UPDATE.
create or replace function public.tg_alerta_lecturas_touch()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_alerta_lecturas_touch on public.alerta_lecturas;
create trigger trg_alerta_lecturas_touch
  before update on public.alerta_lecturas
  for each row execute function public.tg_alerta_lecturas_touch();

-- Seguridad: RLS ON + cerrar a anon (defensa en profundidad, consistente con
-- 20260624_seguridad_cerrar_fuga_anon). Toda la app accede via service role
-- (createAdminClient), que BYPASSA RLS -> las server actions/route funcionan sin
-- friccion. Como nada en la app consulta esta tabla como rol authenticated desde
-- el browser, revocamos a anon y authenticated (no la exponemos via PostgREST).
alter table public.alerta_lecturas enable row level security;
alter table public.alerta_lecturas force row level security;

revoke all on public.alerta_lecturas from anon, authenticated;
