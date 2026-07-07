-- Suma `aseguradora` (Nación / Segurcoop) al FINAL de v_compliance_estado: solo la
-- rama de seguro POR UNIDAD (camion_documentos) la trae; el resto de las ramas van
-- NULL. Se agrega al final para poder usar `create or replace` (no se pueden
-- reordenar/renombrar columnas existentes de una vista).
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
    null::text as aseguradora
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
    null::text
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
    doc.aseguradora
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
    null::text
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
    null::text
   from compliance_requisitos req
     left join lateral ( select cd.id, cd.fecha_vencimiento, cd.archivo_id from compliance_documentos cd
          where cd.requisito_id = req.id and cd.chofer_id is null and cd.camion_id is null
          order by cd.fecha_vencimiento desc, cd.created_at desc limit 1) doc on true
  where req.activo and req.nivel = 'empresa'::compliance_nivel;
