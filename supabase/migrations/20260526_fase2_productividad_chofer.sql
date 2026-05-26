-- FASE 2 del plan post-feedback (26/05/2026): infraestructura de datos para la
-- pestaña PRODUCTIVIDAD del legajo (4.2, prioridad máxima del feedback).
--
-- Score y ranking se posponen — esta migration NO calcula score, solo deja las
-- tablas que después alimentan el cálculo.
--
-- Tablas creadas:
--   - chofer_camion_historial  (+ trigger sync con camiones.chofer_actual_id)
--   - roturas_gomas
--   - apercibimiento_categorias (catálogo editable por Bárbara)
--   - chofer_apercibimientos
--   - chofer_licencias_medicas
--   - chofer_prestamos


-- ────────────────────────────────────────────────────────────────────────────
-- 1) Historial chofer ↔ camión
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.chofer_camion_historial (
  id              uuid primary key default gen_random_uuid(),
  chofer_id       uuid not null references public.choferes(id) on delete cascade,
  camion_id       uuid not null references public.camiones(id) on delete cascade,
  desde           date not null default current_date,
  hasta           date,
  motivo_cambio   text,
  observaciones   text,
  created_at      timestamptz not null default now(),
  created_by      uuid references public.usuarios(id) on delete set null,
  constraint chofer_camion_historial_periodo_ok check (hasta is null or hasta >= desde)
);

create index if not exists chofer_camion_historial_chofer_idx
  on public.chofer_camion_historial (chofer_id, desde desc);

create index if not exists chofer_camion_historial_camion_idx
  on public.chofer_camion_historial (camion_id, desde desc);

-- Un camión tiene UN chofer "actual" a la vez. Si el camión tiene chofer
-- asignado, hay exactamente UNA fila abierta para ese camión.
create unique index if not exists chofer_camion_historial_una_abierta_por_camion
  on public.chofer_camion_historial (camion_id)
  where hasta is null;

alter table public.chofer_camion_historial enable row level security;

create policy select_active_user on public.chofer_camion_historial
  for select using (is_authenticated_active());
create policy insert_active_user on public.chofer_camion_historial
  for insert with check (is_authenticated_active());
create policy update_active_user on public.chofer_camion_historial
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.chofer_camion_historial
  for delete using (is_admin());


-- Trigger: mantener historial sincronizado con `camiones.chofer_actual_id`.
-- Solo registra cambios "naturales" (cuando alguien edita el chofer asignado al
-- camión). Si querés cargar historial pasado a mano, lo hacés directo en la tabla.
create or replace function public.tg_sync_chofer_camion_historial()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.chofer_actual_id is not null then
      insert into public.chofer_camion_historial (chofer_id, camion_id, desde)
      values (new.chofer_actual_id, new.id, current_date);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.chofer_actual_id is distinct from new.chofer_actual_id then
      -- cerrar la asignación abierta del camión (si existe)
      update public.chofer_camion_historial
         set hasta = current_date
       where camion_id = new.id and hasta is null;

      if new.chofer_actual_id is not null then
        insert into public.chofer_camion_historial (chofer_id, camion_id, desde)
        values (new.chofer_actual_id, new.id, current_date);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.chofer_camion_historial
       set hasta = current_date
     where camion_id = old.id and hasta is null;
    return old;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists camiones_sync_chofer_historial on public.camiones;
create trigger camiones_sync_chofer_historial
  after insert or update of chofer_actual_id or delete on public.camiones
  for each row execute function public.tg_sync_chofer_camion_historial();

-- Backfill: por cada camión con chofer asignado hoy, abrir una fila de historial.
insert into public.chofer_camion_historial (chofer_id, camion_id, desde)
select c.chofer_actual_id, c.id, current_date
from public.camiones c
where c.chofer_actual_id is not null
  and not exists (
    select 1 from public.chofer_camion_historial h
    where h.camion_id = c.id and h.hasta is null
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 2) Roturas de gomas (input directo al score de productividad — punto 1 del feedback)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.roturas_gomas (
  id               uuid primary key default gen_random_uuid(),
  chofer_id        uuid references public.choferes(id) on delete set null,
  camion_id        uuid references public.camiones(id) on delete set null,
  acoplado_id      uuid references public.acoplados(id) on delete set null,
  fecha            date not null default current_date,
  posicion         text,
  cantidad         integer not null default 1,
  costo            numeric,
  moneda           text not null default 'ARS',
  mantenimiento_id uuid references public.mantenimientos(id) on delete set null,
  observaciones    text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.usuarios(id) on delete set null,
  constraint roturas_gomas_unidad_requerida check (camion_id is not null or acoplado_id is not null),
  constraint roturas_gomas_cantidad_positiva check (cantidad > 0),
  constraint roturas_gomas_costo_positivo check (costo is null or costo >= 0)
);

create index if not exists roturas_gomas_chofer_idx on public.roturas_gomas (chofer_id, fecha desc);
create index if not exists roturas_gomas_camion_idx on public.roturas_gomas (camion_id, fecha desc);
create index if not exists roturas_gomas_acoplado_idx on public.roturas_gomas (acoplado_id, fecha desc);
create index if not exists roturas_gomas_fecha_idx on public.roturas_gomas (fecha desc);

alter table public.roturas_gomas enable row level security;

create policy select_active_user on public.roturas_gomas
  for select using (is_authenticated_active());
create policy insert_active_user on public.roturas_gomas
  for insert with check (is_authenticated_active());
create policy update_active_user on public.roturas_gomas
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.roturas_gomas
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 3) Apercibimientos
-- ────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.apercibimiento_gravedad as enum ('leve', 'moderado', 'grave');
exception
  when duplicate_object then null;
end $$;

-- Catálogo editable (decisión confirmada por el user: arrancar con defaults
-- y luego Bárbara los reemplaza)
create table if not exists public.apercibimiento_categorias (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  descripcion  text,
  estado       public.tipo_carga_estado not null default 'activo',
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists apercibimiento_categorias_orden_idx
  on public.apercibimiento_categorias (orden);

alter table public.apercibimiento_categorias enable row level security;

create policy select_active_user on public.apercibimiento_categorias
  for select using (is_authenticated_active());
create policy insert_active_user on public.apercibimiento_categorias
  for insert with check (is_authenticated_active());
create policy update_active_user on public.apercibimiento_categorias
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.apercibimiento_categorias
  for delete using (is_admin());

-- Seed con defaults — Bárbara los modifica después
insert into public.apercibimiento_categorias (codigo, nombre, descripcion, orden) values
  ('conduccion',           'Conducción',             'Exceso de velocidad, maniobras peligrosas, accidentes evitables', 10),
  ('documentacion',        'Documentación',          'Documentos vencidos o falta de presentación de remitos/cartas de porte', 20),
  ('comportamiento',       'Comportamiento',         'Faltas de respeto, mala relación con clientes o compañeros', 30),
  ('puntualidad',          'Puntualidad',            'Atrasos, abandono de viaje, no presentarse', 40),
  ('cuidado_vehiculo',     'Cuidado del vehículo',   'No reportar fallas, mal uso del equipo, daños por negligencia', 50),
  ('siniestros_recurrentes','Siniestros recurrentes','Siniestros menores reiterados por descuido del chofer', 60),
  ('otro',                 'Otro',                   'Otros motivos a especificar', 99)
on conflict (codigo) do nothing;


create table if not exists public.chofer_apercibimientos (
  id            uuid primary key default gen_random_uuid(),
  chofer_id     uuid not null references public.choferes(id) on delete cascade,
  fecha         date not null default current_date,
  categoria_id  uuid references public.apercibimiento_categorias(id) on delete set null,
  gravedad      public.apercibimiento_gravedad not null default 'leve',
  motivo        text not null,
  archivo_id    uuid references public.documentos_archivos(id) on delete set null,
  observaciones text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.usuarios(id) on delete set null
);

create index if not exists chofer_apercibimientos_chofer_idx
  on public.chofer_apercibimientos (chofer_id, fecha desc);
create index if not exists chofer_apercibimientos_categoria_idx
  on public.chofer_apercibimientos (categoria_id);
create index if not exists chofer_apercibimientos_fecha_idx
  on public.chofer_apercibimientos (fecha desc);

alter table public.chofer_apercibimientos enable row level security;

create policy select_active_user on public.chofer_apercibimientos
  for select using (is_authenticated_active());
create policy insert_active_user on public.chofer_apercibimientos
  for insert with check (is_authenticated_active());
create policy update_active_user on public.chofer_apercibimientos
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.chofer_apercibimientos
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 4) Licencias médicas (ausencias por enfermedad/accidente — distinto de
--    chofer_documentos, que cubre la licencia DE CONDUCIR)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.chofer_licencias_medicas (
  id                       uuid primary key default gen_random_uuid(),
  chofer_id                uuid not null references public.choferes(id) on delete cascade,
  fecha_desde              date not null,
  fecha_hasta              date,
  motivo                   text,
  certificado_archivo_id   uuid references public.documentos_archivos(id) on delete set null,
  observaciones            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references public.usuarios(id) on delete set null,
  constraint chofer_licencias_medicas_periodo_ok check (fecha_hasta is null or fecha_hasta >= fecha_desde)
);

create index if not exists chofer_licencias_medicas_chofer_idx
  on public.chofer_licencias_medicas (chofer_id, fecha_desde desc);

create index if not exists chofer_licencias_medicas_abiertas_idx
  on public.chofer_licencias_medicas (chofer_id)
  where fecha_hasta is null;

alter table public.chofer_licencias_medicas enable row level security;

create policy select_active_user on public.chofer_licencias_medicas
  for select using (is_authenticated_active());
create policy insert_active_user on public.chofer_licencias_medicas
  for insert with check (is_authenticated_active());
create policy update_active_user on public.chofer_licencias_medicas
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.chofer_licencias_medicas
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 5) Préstamos personales al chofer (caso "Nicolás saca crédito a Luciano").
--    Distinto de viaticos.monto_adelanto (que es adelanto-de-viático-por-viaje).
-- ────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.chofer_prestamo_estado as enum (
    'pendiente',
    'parcial',
    'cancelado',
    'incobrable'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.chofer_prestamos (
  id              uuid primary key default gen_random_uuid(),
  chofer_id       uuid not null references public.choferes(id) on delete cascade,
  fecha           date not null default current_date,
  monto           numeric not null,
  moneda          text not null default 'ARS',
  motivo          text,
  cuotas          integer not null default 1,
  saldo_pendiente numeric not null,
  estado          public.chofer_prestamo_estado not null default 'pendiente',
  observaciones   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.usuarios(id) on delete set null,
  constraint chofer_prestamos_monto_positivo check (monto > 0),
  constraint chofer_prestamos_cuotas_positivas check (cuotas >= 1),
  constraint chofer_prestamos_saldo_ok check (saldo_pendiente >= 0 and saldo_pendiente <= monto)
);

create index if not exists chofer_prestamos_chofer_idx
  on public.chofer_prestamos (chofer_id, fecha desc);

create index if not exists chofer_prestamos_estado_idx
  on public.chofer_prestamos (estado);

alter table public.chofer_prestamos enable row level security;

create policy select_active_user on public.chofer_prestamos
  for select using (is_authenticated_active());
create policy insert_active_user on public.chofer_prestamos
  for insert with check (is_authenticated_active());
create policy update_active_user on public.chofer_prestamos
  for update using (is_authenticated_active()) with check (is_authenticated_active());
create policy delete_admin_only on public.chofer_prestamos
  for delete using (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 6) Triggers updated_at en tablas que se editan
-- ────────────────────────────────────────────────────────────────────────────

drop trigger if exists apercibimiento_categorias_set_updated_at on public.apercibimiento_categorias;
create trigger apercibimiento_categorias_set_updated_at
  before update on public.apercibimiento_categorias
  for each row execute function public.tg_set_updated_at();

drop trigger if exists chofer_licencias_medicas_set_updated_at on public.chofer_licencias_medicas;
create trigger chofer_licencias_medicas_set_updated_at
  before update on public.chofer_licencias_medicas
  for each row execute function public.tg_set_updated_at();

drop trigger if exists chofer_prestamos_set_updated_at on public.chofer_prestamos;
create trigger chofer_prestamos_set_updated_at
  before update on public.chofer_prestamos
  for each row execute function public.tg_set_updated_at();
