-- Catálogo de insumos + costo de repuestos por chofer (Tema 5, pedido de Bárbara)
-- Creado: 01/07/2026
--
-- Bárbara quiere saber cuánto le cuesta cada chofer en repuestos, pero el taller
-- NO tiene las facturas (llegan directo a administración). Solución acordada con
-- Nico: no cargar facturas. Se arma un catálogo editable de los insumos más
-- comunes (goma, lámpara, óptica, etc.) con marca + precio, que administración
-- actualiza cada 2-3 meses. Al cargar una rotura, el taller elige el insumo y el
-- sistema trae el importe solo (queda editable). El sistema recuerda actualizar
-- precios (motor de alertas).

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Catálogo de insumos
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.insumos_catalogo (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  text not null default 'goma',   -- categoría alineada con TIPOS_ROTURA (goma, llanta, optica, espejo, ...)
  nombre                text not null,                   -- descripción visible ("Goma dirección 295/80")
  marca                 text,                            -- Michelin, Bazán, Work… (opcional)
  precio                numeric not null default 0,
  moneda                text not null default 'ARS',
  estado                public.tipo_carga_estado not null default 'activo',
  orden                 integer not null default 0,
  precio_actualizado_en date not null default current_date,
  observaciones         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.usuarios(id) on delete set null,
  constraint insumos_catalogo_precio_positivo check (precio >= 0)
);

create index if not exists insumos_catalogo_estado_orden_idx
  on public.insumos_catalogo (estado, orden);

alter table public.insumos_catalogo enable row level security;

-- RLS coherente con el módulo de mantenimiento (mismo patrón que costos_rep_rep):
-- lectura/carga para usuarios activos; borrado solo admin.
drop policy if exists select_active_user on public.insumos_catalogo;
create policy select_active_user on public.insumos_catalogo
  for select using (is_authenticated_active());
drop policy if exists insert_active_user on public.insumos_catalogo;
create policy insert_active_user on public.insumos_catalogo
  for insert with check (is_authenticated_active());
drop policy if exists update_active_user on public.insumos_catalogo;
create policy update_active_user on public.insumos_catalogo
  for update using (is_authenticated_active()) with check (is_authenticated_active());
drop policy if exists delete_admin_only on public.insumos_catalogo;
create policy delete_admin_only on public.insumos_catalogo
  for delete using (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Roturas: vínculo al catálogo + marca + estado de uso (planilla real)
-- ────────────────────────────────────────────────────────────────────────────
--
-- La planilla que usan hoy anota, para gomas: marca (Michelin, Bazán…) y "% de
-- uso / estado" ("30% de uso", "media", "casi nueva"). Lo modelamos igual.
-- insumo_id permite traer el importe del catálogo sin cargar facturas.

alter table public.roturas_gomas
  add column if not exists insumo_id uuid references public.insumos_catalogo(id) on delete set null;
alter table public.roturas_gomas
  add column if not exists marca text;
alter table public.roturas_gomas
  add column if not exists estado_uso text;

comment on column public.roturas_gomas.insumo_id is
  'Insumo del catálogo elegido al cargar la rotura; de ahí se trae el precio.';
comment on column public.roturas_gomas.marca is
  'Marca de la goma/insumo (planilla real de Bárbara): Michelin, Bazán, Work, etc.';
comment on column public.roturas_gomas.estado_uso is
  'Estado / % de uso al momento de la rotura: "30% de uso", "media", "casi nueva".';

create index if not exists roturas_gomas_insumo_idx on public.roturas_gomas (insumo_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Seed inicial (precios en 0 → Bárbara los completa; arranca con los comunes)
-- ────────────────────────────────────────────────────────────────────────────

insert into public.insumos_catalogo (tipo, nombre, marca, precio, orden)
select v.tipo, v.nombre, v.marca, 0, v.orden
from (values
  ('goma',         'Goma / cubierta',        null::text, 10),
  ('llanta',       'Llanta',                 null::text, 20),
  ('optica',       'Lámpara',                null::text, 30),
  ('optica',       'Óptica / faro',          null::text, 40),
  ('espejo',       'Espejo',                 null::text, 50),
  ('parabrisas',   'Parabrisas / vidrio',    null::text, 60),
  ('guardabarros', 'Guardabarros',           null::text, 70),
  ('paragolpes',   'Paragolpes / defensa',   null::text, 80)
) as v(tipo, nombre, marca, orden)
where not exists (select 1 from public.insumos_catalogo);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Parámetro: recordatorio de actualización de precios (meses)
-- ────────────────────────────────────────────────────────────────────────────

insert into public.parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable)
values (
  'alerta_insumo_precio_meses',
  '3',
  'number',
  'notificaciones',
  'Cada cuántos meses recordar actualizar los precios del catálogo de insumos.',
  true
)
on conflict (clave) do nothing;
