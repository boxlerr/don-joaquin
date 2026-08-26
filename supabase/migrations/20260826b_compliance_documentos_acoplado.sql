-- Acoplados en Compliance — PASO B: dónde vive el papel del acoplado.
--
-- Corre DESPUÉS de 20260826a (el enum) y en otra corrida.
--
-- No se crea `acoplado_documentos`. `compliance_documentos` ya guarda los
-- papeles que no van al legajo (chofer_id y camion_id son nullables y el
-- requisito de empresa va con los dos en null), ya tiene su tabla puente de
-- adjuntos multi-archivo (`compliance_documento_archivos`) y ya tiene RLS por
-- área. Sumarle una columna es una fila más en el mismo lugar; duplicar toda la
-- estructura del camión serían dos tablas, dos policies y dos ramas de código
-- para guardar exactamente lo mismo.

alter table public.compliance_documentos
  add column if not exists acoplado_id uuid references public.acoplados(id) on delete cascade;

create index if not exists compliance_documentos_acoplado_idx
  on public.compliance_documentos (acoplado_id);

-- Un documento es de UNA cosa: del chofer, de la unidad, del acoplado, o de la
-- empresa (los tres en null). Nunca de dos a la vez.
alter table public.compliance_documentos
  drop constraint if exists compliance_documentos_una_entidad;
alter table public.compliance_documentos
  add constraint compliance_documentos_una_entidad
  check (num_nonnulls(chofer_id, camion_id, acoplado_id) <= 1);

-- El índice único de los documentos de EMPRESA mira "los tres en null". Con la
-- columna nueva hay que rehacerlo: sin `acoplado_id is null`, dos documentos de
-- acoplados distintos con la misma fecha se pisarían entre sí.
drop index if exists public.compliance_doc_empresa_uniq;
create unique index compliance_doc_empresa_uniq
  on public.compliance_documentos (requisito_id, fecha_vencimiento)
  where chofer_id is null and camion_id is null and acoplado_id is null;

-- La vista `v_compliance_estado` es `security_invoker`, así que la nueva rama
-- de acoplados lee `acoplados` con los permisos de quien consulta: compliance
-- tiene que poder leer esa tabla. Se rehace su policy de lectura con el mismo
-- patrón de 20260819_rls_por_area_fase2.sql (áreas que leen / áreas que
-- escriben), agregando `compliance` a la lectura y dejando la escritura en
-- flota, que es la dueña de la flota.
do $$
declare
  pol record;
  cond_lectura   text;
  cond_escritura text;
  cond_borrado   text;
  leen   text := 'flota,viajes,mantenimiento,compliance';
  escriben text := 'flota';
begin
  select string_agg(format('can_read_area(%L)', trim(x)), ' or ')
    into cond_lectura from unnest(string_to_array(leen, ',')) as x;
  select string_agg(format('can_write_area(%L)', trim(x)), ' or ')
    into cond_escritura from unnest(string_to_array(escriben, ',')) as x;
  select string_agg(format('current_area_rank(%L) >= 3', trim(x)), ' or ')
    into cond_borrado from unnest(string_to_array(escriben, ',')) as x;

  for pol in select polname from pg_policy where polrelid = 'public.acoplados'::regclass
  loop
    execute format('drop policy %I on public.acoplados', pol.polname);
  end loop;

  execute format('create policy acoplados_sel on public.acoplados for select using (%s)', cond_lectura);
  execute format('create policy acoplados_ins on public.acoplados for insert with check (%s)', cond_escritura);
  execute format('create policy acoplados_upd on public.acoplados for update using (%s) with check (%s)', cond_escritura, cond_escritura);
  execute format('create policy acoplados_del on public.acoplados for delete using (%s)', cond_borrado);
end $$;
