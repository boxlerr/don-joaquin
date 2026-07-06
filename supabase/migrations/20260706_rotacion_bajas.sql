-- Rotación de choferes: dataset editable de BAJAS + parámetros anuales del índice.
-- ---------------------------------------------------------------------------
-- Hasta ahora la rotación se derivaba 100% de `choferes` (fecha_ingreso/egreso),
-- pero los egresados históricos (los que se fueron y ya no están en la tabla) no
-- quedaban registrados → los números de 2025 no cerraban. Se agrega un registro
-- de bajas propio (cargable/editable, como la planilla del cliente) + los
-- parámetros del índice por año (flota inicial/final para la dotación promedio).

-- 1) Registro de bajas (una fila por egreso). `chofer_id` opcional: muchas bajas
--    son de gente que ya no está en `choferes`.
create table if not exists public.rotacion_bajas (
  id               uuid primary key default gen_random_uuid(),
  chofer_id        uuid references public.choferes(id) on delete set null,
  nombre           text not null,
  fecha_ingreso    date,
  fecha_egreso     date,
  anio             integer not null,               -- año al que se imputa la baja
  antiguedad_meses integer,                         -- antigüedad al egresar, en meses (para tramos)
  antiguedad_texto text,                            -- texto original ("2 años", "8 meses")
  tipo_baja        text not null default 'renuncia_voluntaria',
  motivo           text,
  base_zona        text,
  observaciones    text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.usuarios(id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.usuarios(id) on delete set null,
  constraint rotacion_bajas_tipo_ok
    check (tipo_baja in ('renuncia_voluntaria','despido','jubilacion','abandono','otro'))
);
create index if not exists rotacion_bajas_anio_idx on public.rotacion_bajas (anio);

comment on table public.rotacion_bajas is
  'Registro de bajas de choferes (rotación). Incluye egresados históricos que no están en la tabla choferes.';

-- 2) Parámetros del índice por año: flota inicial/final (→ dotación promedio).
--    Si un año no tiene fila, la app cae a derivar la dotación desde choferes.
create table if not exists public.rotacion_anual (
  anio           integer primary key,
  flota_inicial  integer,
  flota_final    integer,
  observaciones  text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.usuarios(id) on delete set null,
  constraint rotacion_anual_flota_ok
    check ((flota_inicial is null or flota_inicial >= 0) and (flota_final is null or flota_final >= 0))
);

comment on table public.rotacion_anual is
  'Parámetros anuales del índice de rotación: flota inicial/final para la dotación promedio.';

-- RLS: leer/cargar = usuario activo; borrar = admin (igual que insumos_catalogo).
do $$
declare t text;
begin
  foreach t in array array['rotacion_bajas','rotacion_anual'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists select_active_user on public.%I', t);
    execute format('create policy select_active_user on public.%I for select using (is_authenticated_active())', t);
    execute format('drop policy if exists insert_active_user on public.%I', t);
    execute format('create policy insert_active_user on public.%I for insert with check (is_authenticated_active())', t);
    execute format('drop policy if exists update_active_user on public.%I', t);
    execute format('create policy update_active_user on public.%I for update using (is_authenticated_active()) with check (is_authenticated_active())', t);
    execute format('drop policy if exists delete_admin_only on public.%I', t);
    execute format('create policy delete_admin_only on public.%I for delete using (is_admin())', t);
  end loop;
end $$;

-- updated_at automático
drop trigger if exists rotacion_bajas_set_updated_at on public.rotacion_bajas;
create trigger rotacion_bajas_set_updated_at
  before update on public.rotacion_bajas
  for each row execute function public.tg_set_updated_at();

drop trigger if exists rotacion_anual_set_updated_at on public.rotacion_anual;
create trigger rotacion_anual_set_updated_at
  before update on public.rotacion_anual
  for each row execute function public.tg_set_updated_at();

-- Seed con los datos reales del Excel del cliente (solo si las tablas están vacías).
insert into public.rotacion_anual (anio, flota_inicial, flota_final)
select * from (values (2025, 51, 60), (2026, 60, 62)) as v(anio, fi, ff)
on conflict (anio) do nothing;

insert into public.rotacion_bajas (nombre, fecha_ingreso, fecha_egreso, anio, antiguedad_meses, antiguedad_texto, tipo_baja)
select * from (values
  ('MENDOZA','2023-03-01'::date,'2025-03-01'::date,2025,24,'2 años','despido'),
  ('FERREYRA','2024-05-01'::date,null::date,2025,8,'8 meses','renuncia_voluntaria'),
  ('BORDENAVE','2023-10-01'::date,null::date,2025,15,'1 año y 3 meses','renuncia_voluntaria'),
  ('CASTEX','2024-02-01'::date,null::date,2025,11,'11 meses','renuncia_voluntaria'),
  ('HERLEIN','2018-01-01'::date,null::date,2025,84,'7 años','renuncia_voluntaria'),
  ('RAMOS CARLOS','2024-02-01'::date,null::date,2025,11,'11 meses','renuncia_voluntaria'),
  ('SERGIO BUENO','2023-03-01'::date,null::date,2025,22,'1 año y 10 meses','renuncia_voluntaria'),
  ('NAHUEL BUENO','2022-07-01'::date,null::date,2025,30,'2 años y 6 meses','renuncia_voluntaria'),
  ('PITTANA CARLOS','2024-07-01'::date,null::date,2025,6,'6 meses','renuncia_voluntaria'),
  ('CARDARELLI','2021-07-01'::date,null::date,2025,42,'3 años y medio','renuncia_voluntaria'),
  ('MIGUEL MARTINEZ',null::date,null::date,2025,null::int,'—','jubilacion'),
  ('PITTANA JORGE','2026-01-01'::date,'2026-05-01'::date,2026,4,'4 meses','renuncia_voluntaria'),
  ('LAGANO GUILLERMO','2023-05-01'::date,'2026-05-01'::date,2026,36,'3 años','renuncia_voluntaria'),
  ('SALTO IVAN','2019-05-01'::date,'2026-05-01'::date,2026,84,'7 años','renuncia_voluntaria'),
  ('ARCUBY LUCAS','2024-05-01'::date,'2026-05-01'::date,2026,24,'2 años','renuncia_voluntaria'),
  ('GOMEZ RICARDO','2026-05-01'::date,'2026-05-19'::date,2026,0,'~2 semanas','renuncia_voluntaria')
) as v(nombre, fi, fe, anio, am, at, tipo)
where not exists (select 1 from public.rotacion_bajas);
