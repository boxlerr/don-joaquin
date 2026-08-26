-- Acoplados en Compliance — PASO E: la vista.
--
-- Corre DESPUÉS de A, B y C (necesita el enum, la columna y los requisitos).
--
-- `create or replace`, NUNCA `drop view`. La vista tiene `security_invoker` y
-- los `revoke ... from anon, authenticated` que pusieron a mano las migraciones
-- de seguridad del 24/06 y del 13/07; un DROP se los lleva puestos y reabre la
-- fuga a `anon` que ya se cerró dos veces. Por eso las dos columnas nuevas van
-- AL FINAL: `create or replace` no deja insertar columnas en el medio.
--
-- Cambios respecto de la versión del 07/07:
--   · dos columnas nuevas al final: acoplado_id, acoplado_patente;
--   · una sexta rama con los requisitos de nivel 'acoplado'.

create or replace view public.v_compliance_estado as
 select req.id as requisito_id, req.codigo as requisito_codigo, req.nombre as requisito_nombre,
    req.cliente_aplica, req.nivel, req.dias_alerta, req.periodicidad,
    ch.id as chofer_id, (ch.nombre || ' '::text) || ch.apellido as chofer_nombre,
    null::uuid as camion_id, null::text as camion_patente,
    doc.id as documento_id, 'chofer_documentos'::text as documento_fuente,
    doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end as estado,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end as dias_restantes,
    null::text as aseguradora,
    null::uuid as acoplado_id, null::text as acoplado_patente
   from compliance_requisitos req cross join choferes ch
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from chofer_documentos cd
          where cd.chofer_id = ch.id and cd.tipo_documento_id = req.tipo_documento_id
          order by cd.fecha_vencimiento desc nulls last, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'chofer'::compliance_nivel and req.tipo_documento_id is not null and ch.estado = 'activo'::chofer_estado
union all
 select req.id, req.codigo, req.nombre, req.cliente_aplica, req.nivel, req.dias_alerta, req.periodicidad,
    ch.id, (ch.nombre || ' '::text) || ch.apellido, null::uuid, null::text,
    doc.id, 'compliance_documentos'::text, doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end,
    null::text, null::uuid, null::text
   from compliance_requisitos req cross join choferes ch
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from compliance_documentos cd
          where cd.requisito_id = req.id and cd.chofer_id = ch.id
          order by cd.fecha_vencimiento desc, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'chofer'::compliance_nivel and req.tipo_documento_id is null and ch.estado = 'activo'::chofer_estado
union all
 select req.id, req.codigo, req.nombre, req.cliente_aplica, req.nivel, req.dias_alerta, req.periodicidad,
    null::uuid, null::text, cam.id, cam.patente,
    doc.id, 'camion_documentos'::text, doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end,
    doc.aseguradora, null::uuid, null::text
   from compliance_requisitos req cross join camiones cam
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id, cd.aseguradora from camion_documentos cd
          where cd.camion_id = cam.id and cd.tipo_documento_id = req.tipo_documento_id
          order by cd.fecha_vencimiento desc nulls last, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'unidad'::compliance_nivel and req.tipo_documento_id is not null and cam.estado = 'activo'::camion_estado
union all
 select req.id, req.codigo, req.nombre, req.cliente_aplica, req.nivel, req.dias_alerta, req.periodicidad,
    null::uuid, null::text, cam.id, cam.patente,
    doc.id, 'compliance_documentos'::text, doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end,
    null::text, null::uuid, null::text
   from compliance_requisitos req cross join camiones cam
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from compliance_documentos cd
          where cd.requisito_id = req.id and cd.camion_id = cam.id
          order by cd.fecha_vencimiento desc, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'unidad'::compliance_nivel and req.tipo_documento_id is null and cam.estado = 'activo'::camion_estado
union all
 select req.id, req.codigo, req.nombre, req.cliente_aplica, req.nivel, req.dias_alerta, req.periodicidad,
    null::uuid, null::text, null::uuid, null::text,
    doc.id, 'compliance_documentos'::text, doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end,
    null::text, null::uuid, null::text
   from compliance_requisitos req
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from compliance_documentos cd
          where cd.requisito_id = req.id and cd.chofer_id is null and cd.camion_id is null
          order by cd.fecha_vencimiento desc, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'empresa'::compliance_nivel
union all
 -- ── Acoplados ────────────────────────────────────────────────────────────
 -- El acoplado es un vehículo con patente y papeles propios: su VTV, las
 -- válvulas de seguridad y el disco de ruptura, que están montados sobre la
 -- cisterna. Hasta el 26/08/2026 esta rama no existía y esos papeles se
 -- cargaban sobre el chasis enganchado.
 --
 -- El alcance que se DEVUELVE es 'unidad', no 'acoplado': la fila se muestra en
 -- la ficha del chasis que lo lleva puesto, que es por donde entra quien carga.
 -- El acoplado sigue siendo el dueño del papel —lo dicen acoplado_id y
 -- acoplado_patente— y `compliance_requisitos.nivel` sigue diciendo 'acoplado'.
 --
 -- Que la traducción viva acá y no en el código tiene una razón concreta: la
 -- base es la MISMA para local y para producción, y un valor de alcance que el
 -- código desplegado no conoce le rompe la pantalla a todo el mundo. Devolviendo
 -- 'unidad', la versión vieja del código muestra los papeles del acoplado
 -- mezclados con los del chasis —como venían cargándolos a mano— y la nueva los
 -- separa en su propia tira.
 select req.id, req.codigo, req.nombre, req.cliente_aplica,
    'unidad'::compliance_nivel, req.dias_alerta, req.periodicidad,
    null::uuid, null::text, cam.id, cam.patente,
    doc.id, 'compliance_documentos'::text, doc.fecha_vencimiento, doc.archivo_id,
    case when doc.id is null or doc.fecha_vencimiento is null then 'faltante'::text
         when doc.fecha_vencimiento < current_date then 'vencido'::text
         when doc.fecha_vencimiento <= (current_date + ((req.dias_alerta || ' days'::text)::interval)) then 'por_vencer'::text
         else 'vigente'::text end,
    case when doc.fecha_vencimiento is null then null::integer else doc.fecha_vencimiento - current_date end,
    null::text, aco.id, aco.patente
   from compliance_requisitos req cross join acoplados aco
     left join camion_acoplados ca on ca.acoplado_id = aco.id and ca.hasta is null
     left join camiones cam on cam.id = ca.camion_id and cam.estado = 'activo'::camion_estado
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from compliance_documentos cd
          where cd.requisito_id = req.id and cd.acoplado_id = aco.id
          order by cd.fecha_vencimiento desc, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'acoplado'::compliance_nivel and aco.estado = 'activo';
-- `create or replace view` NO conserva las opciones de la vista: después del
-- replace, `reloptions` quedó en null y la vista perdió el `security_invoker`
-- que le puso la migración del 24/06. Los `revoke` a anon/authenticated sí
-- sobrevivieron —se verificó: sólo postgres y service_role tienen SELECT—,
-- pero se repiten por las dudas. Esto va SIEMPRE al final de cualquier replace
-- de esta vista.
alter view public.v_compliance_estado set (security_invoker = true);
revoke all on table public.v_compliance_estado from anon, authenticated;

