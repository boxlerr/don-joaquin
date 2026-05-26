-- FASE 7 del plan post-feedback (26/05/2026): tonelaje del viaje discriminado.
--
-- El Excel de hoja de ruta de Bárbara trae 3 columnas: TN COM 29, TN ESC 35, TN ESC 37.5.
-- Hoy `viajes.tonelaje_real` es un solo número y se pierde la categorización.
-- A futuro pueden aparecer más categorías (ESC 45, por material, etc.), así que en
-- vez de 3 columnas fijas (Opción A descartada) → catálogo + tabla detalle (Opción B).
--
-- Compatibilidad: `viajes.tonelaje_real` se mantiene como columna normal. Cuando
-- existe detalle, un trigger fuerza tonelaje_real = sum(detalle). Cuando no hay
-- detalle (viajes cargados con el form actual), tonelaje_real se respeta como hoy.


-- ────────────────────────────────────────────────────────────────────────────
-- 1) Catálogo editable de categorías de tonelaje
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.tonelaje_categorias (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text,
  estado       public.tipo_carga_estado not null default 'activo',
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tonelaje_categorias_estado_idx on public.tonelaje_categorias (estado);
create index if not exists tonelaje_categorias_orden_idx on public.tonelaje_categorias (orden);

alter table public.tonelaje_categorias enable row level security;

create policy select_active_user on public.tonelaje_categorias
  for select using (is_authenticated_active());
create policy insert_active_user on public.tonelaje_categorias
  for insert with check (is_authenticated_active());
create policy update_active_user on public.tonelaje_categorias
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.tonelaje_categorias
  for delete using (is_admin());

drop trigger if exists tonelaje_categorias_set_updated_at on public.tonelaje_categorias;
create trigger tonelaje_categorias_set_updated_at
  before update on public.tonelaje_categorias
  for each row execute function public.tg_set_updated_at();

-- Seed con las 3 categorías del Excel actual. Bárbara puede agregar más desde la UI.
insert into public.tonelaje_categorias (codigo, nombre, descripcion, orden) values
  ('com_29',   'Común 29 tn',     'Tonelaje categoría común hasta 29 tn (TN COM 29 del Excel)', 10),
  ('esc_35',   'Escala 35 tn',    'Tonelaje escala 35 tn (TN ESC 35 del Excel)',                20),
  ('esc_37_5', 'Escala 37.5 tn',  'Tonelaje escala 37.5 tn (TN ESC 37.5 del Excel)',            30)
on conflict (codigo) do nothing;


-- ────────────────────────────────────────────────────────────────────────────
-- 2) Detalle por viaje
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.viaje_tonelaje_detalle (
  id            uuid primary key default gen_random_uuid(),
  viaje_id      uuid not null references public.viajes(id) on delete cascade,
  categoria_id  uuid not null references public.tonelaje_categorias(id) on delete restrict,
  toneladas     numeric not null,
  observaciones text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.usuarios(id) on delete set null,
  constraint viaje_tonelaje_detalle_toneladas_positivas check (toneladas > 0),
  constraint viaje_tonelaje_detalle_unico_por_categoria unique (viaje_id, categoria_id)
);

create index if not exists viaje_tonelaje_detalle_viaje_idx
  on public.viaje_tonelaje_detalle (viaje_id);
create index if not exists viaje_tonelaje_detalle_categoria_idx
  on public.viaje_tonelaje_detalle (categoria_id);

alter table public.viaje_tonelaje_detalle enable row level security;

create policy select_active_user on public.viaje_tonelaje_detalle
  for select using (is_authenticated_active());
create policy insert_active_user on public.viaje_tonelaje_detalle
  for insert with check (is_authenticated_active());
create policy update_active_user on public.viaje_tonelaje_detalle
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.viaje_tonelaje_detalle
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Trigger: sincronizar viajes.tonelaje_real con la suma del detalle
--
--    Semántica:
--    - Mientras un viaje no tenga filas en el detalle, su `tonelaje_real` queda
--      como lo escribe el form actual (compat hacia atrás).
--    - Cuando aparece la primera fila de detalle, `tonelaje_real` pasa a ser
--      el espejo de sum(detalle).
--    - Si se borran todas las filas de detalle, `tonelaje_real` queda en 0
--      (señal de que el viaje no tiene tonelaje cargado).
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_sync_viaje_tonelaje_real()
returns trigger as $$
declare
  v_viaje_id uuid;
begin
  if tg_op = 'DELETE' then
    v_viaje_id := old.viaje_id;
  else
    v_viaje_id := new.viaje_id;
  end if;

  update public.viajes v
     set tonelaje_real = coalesce((
       select sum(d.toneladas)
         from public.viaje_tonelaje_detalle d
        where d.viaje_id = v_viaje_id
     ), 0)
   where v.id = v_viaje_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists viaje_tonelaje_detalle_sync_total on public.viaje_tonelaje_detalle;
create trigger viaje_tonelaje_detalle_sync_total
  after insert or update or delete on public.viaje_tonelaje_detalle
  for each row execute function public.tg_sync_viaje_tonelaje_real();
