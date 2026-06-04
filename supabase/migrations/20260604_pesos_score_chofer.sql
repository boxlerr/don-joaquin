-- Tabla singleton para los pesos del score de productividad del chofer.
-- Un solo registro. Los admins lo editan desde la pestaña Productividad del legajo.

create table if not exists public.pesos_score_chofer (
  id                  uuid primary key default gen_random_uuid(),
  peso_vacios_bajo    numeric(5,2) not null default 8,   -- penalty si pct_vacios > umbral_bajo
  peso_vacios_medio   numeric(5,2) not null default 15,  -- penalty si pct_vacios > umbral_medio
  peso_vacios_alto    numeric(5,2) not null default 20,  -- penalty si pct_vacios > umbral_alto
  umbral_vacios_bajo  numeric(5,2) not null default 20,  -- % vacíos que activa penalidad baja
  umbral_vacios_medio numeric(5,2) not null default 30,
  umbral_vacios_alto  numeric(5,2) not null default 40,
  peso_apercibimiento numeric(5,2) not null default 8,   -- penalty por apercibimiento del mes
  peso_rotura         numeric(5,2) not null default 5,   -- penalty por evento de rotura del mes
  peso_licencia       numeric(5,2) not null default 10,  -- penalty si hay licencia activa
  actualizado_por     uuid references public.usuarios(id) on delete set null,
  updated_at          timestamptz not null default now(),
  constraint pesos_positivos check (
    peso_vacios_bajo >= 0 and peso_vacios_medio >= 0 and peso_vacios_alto >= 0
    and peso_apercibimiento >= 0 and peso_rotura >= 0 and peso_licencia >= 0
  ),
  constraint umbrales_ordenados check (
    umbral_vacios_bajo < umbral_vacios_medio and umbral_vacios_medio < umbral_vacios_alto
  )
);

alter table public.pesos_score_chofer enable row level security;

create policy select_active_user on public.pesos_score_chofer
  for select using (is_authenticated_active());

create policy update_admin_only on public.pesos_score_chofer
  for update using (is_admin()) with check (is_admin());

create policy insert_admin_only on public.pesos_score_chofer
  for insert with check (is_admin());

-- Fila de configuración por defecto
insert into public.pesos_score_chofer (
  peso_vacios_bajo, peso_vacios_medio, peso_vacios_alto,
  umbral_vacios_bajo, umbral_vacios_medio, umbral_vacios_alto,
  peso_apercibimiento, peso_rotura, peso_licencia
) values (8, 15, 20, 20, 30, 40, 8, 5, 10);

drop trigger if exists pesos_score_chofer_set_updated_at on public.pesos_score_chofer;
create trigger pesos_score_chofer_set_updated_at
  before update on public.pesos_score_chofer
  for each row execute function public.tg_set_updated_at();
