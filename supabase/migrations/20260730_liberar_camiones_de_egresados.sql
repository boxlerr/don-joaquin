-- Camiones que quedaron "a nombre de" un chofer egresado.
--
-- Desde ahora, egresar libera la unidad sola (src/lib/chofer-egreso.ts, llamado
-- desde egresarChoferAction y updateChoferInfoAction). Esto arregla los que
-- venían de antes: seguían apareciendo como asignados en /camiones, en la
-- planilla diaria y en el legajo de alguien que ya no está en la empresa.
--
-- El trigger camiones_sync_chofer_historial cierra solo el tramo abierto en
-- chofer_camion_historial, así que no se pierde quién manejó qué.
-- Idempotente: si no queda ninguno, no hace nada.

-- 1) Liberar la unidad. El trigger cierra el tramo abierto con current_date.
update public.camiones c
   set chofer_actual_id = null
  from public.choferes ch
 where ch.id = c.chofer_actual_id
   and ch.estado = 'baja';

-- 2) El tramo quedó cerrado con la fecha de hoy. Si el egreso fue antes, el
--    historial estaría diciendo que manejó hasta hoy.
update public.chofer_camion_historial h
   set hasta = ch.fecha_egreso
  from public.choferes ch
 where ch.id = h.chofer_id
   and ch.estado = 'baja'
   and h.hasta = current_date
   and ch.fecha_egreso is not null
   and ch.fecha_egreso < current_date
   -- Un tramo no puede terminar antes de empezar.
   and h.desde <= ch.fecha_egreso;
