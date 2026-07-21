-- BTB era un duplicado de VTV (21/07/2026).
--
-- El requisito por unidad `UNID_BTB` ("BTB") se había cargado el 01/07 como parte
-- del §9 pendiente, pero es el MISMO trámite que `VTV`, que existe desde el 28/05
-- y es el que la gente usa: VTV tenía los 62 documentos cargados (uno por unidad)
-- y BTB, cero. Con los dos activos la papeleta pedía el mismo papel dos veces por
-- camión (62 filas de más).
--
-- Se DESACTIVA en vez de borrarse: `v_compliance_estado` filtra por `req.activo`
-- en todas sus ramas, así que con esto desaparece del checklist, pero la fila
-- queda por si hubiera que revisar el historial (o revertirlo con activo = true).

update public.compliance_requisitos
   set activo = false,
       updated_at = now()
 where codigo = 'UNID_BTB';
