-- Vacaciones por año: días otorgados por período (2025, 2026, …) por empleado.
-- Reemplaza el saldo colapsado de chofer_vacaciones (corresponden + adeudados):
-- el saldo restante de cada año se DERIVA restando los períodos cargados en
-- chofer_ausencias (es_vacaciones) con consumo FIFO (primero el año más viejo).
-- chofer_vacaciones queda en desuso (se conserva como respaldo de la carga vieja).

create table if not exists public.chofer_vacaciones_anios (
  id uuid primary key default gen_random_uuid(),
  chofer_id uuid not null references public.choferes(id) on delete cascade,
  anio integer not null,
  dias_correspondientes integer not null default 0,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id),
  unique (chofer_id, anio)
);

create index if not exists idx_chofer_vacaciones_anios_chofer
  on public.chofer_vacaciones_anios (chofer_id, anio);

alter table public.chofer_vacaciones_anios enable row level security;

drop policy if exists select_active_user on public.chofer_vacaciones_anios;
create policy select_active_user on public.chofer_vacaciones_anios
  for select using (is_authenticated_active());

drop policy if exists insert_active_user on public.chofer_vacaciones_anios;
create policy insert_active_user on public.chofer_vacaciones_anios
  for insert with check (is_authenticated_active());

drop policy if exists update_active_user on public.chofer_vacaciones_anios;
create policy update_active_user on public.chofer_vacaciones_anios
  for update using (is_authenticated_active()) with check (is_authenticated_active());

drop policy if exists delete_admin_only on public.chofer_vacaciones_anios;
create policy delete_admin_only on public.chofer_vacaciones_anios
  for delete using (is_admin());

-- A qué año de vacaciones se imputa cada período. Se asigna al crear el período
-- (el año más viejo con saldo). NULL = histórico anterior a la conciliación:
-- ya está reflejado en los días otorgados y no vuelve a descontar.
alter table public.chofer_ausencias add column if not exists anio_cargo integer;
comment on column public.chofer_ausencias.anio_cargo is 'Año de vacaciones al que se imputa el período (debita chofer_vacaciones_anios). NULL = histórico, ya reflejado en la carga inicial: no descuenta.';
