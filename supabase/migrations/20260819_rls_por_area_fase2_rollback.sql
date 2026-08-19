-- VUELTA ATRÁS de la Fase 2 del RLS por área (20260819_rls_por_area_fase2.sql).
--
-- Este archivo NO se corre en el deploy: está acá para poder deshacer en un
-- minuto si aparece una pantalla rota que no vimos. Devuelve las policies
-- genéricas que había antes (cualquier usuario activo lee/escribe, borra el
-- admin) sobre las mismas tablas que tocó la Fase 2.
--
-- Ojo: al volver atrás se pierde la segregación por área en esas tablas. Es un
-- botón de emergencia, no un estado deseable.

do $$
declare
  r record;
  pol record;
begin
  for r in
    select unnest(array[
      'choferes','chofer_documentos','chofer_documento_archivos',
      'chofer_apercibimientos','apercibimiento_archivos','apercibimiento_categorias',
      'chofer_ausencias','chofer_licencias_medicas','chofer_prestamos',
      'chofer_vacaciones','chofer_vacaciones_anios','rotacion_anual','rotacion_bajas',
      'viajes','viaje_archivos','viaje_tonelaje_detalle','hojas_ruta','hoja_ruta_items',
      'asignacion_diaria','rutas','puntos_ruta','rutas_cliente_km',
      'camiones','acoplados','camion_acoplados','camion_documentos',
      'camion_documento_archivos','camion_fotos','chofer_camion_historial',
      'mantenimientos','mantenimiento_archivos','roturas_gomas','rotura_archivos',
      'costos_rep_rep','insumos_catalogo','cargas_combustible',
      'clientes','cliente_contactos','cliente_sucursales','cliente_requisitos','tarifas',
      'compliance_documentos','compliance_documento_archivos','compliance_destinatarios',
      'compliance_dm_ypf','compliance_liq_loma',
      'siniestros','siniestro_archivos','extintores',
      'documentos_archivos','pesos_score_chofer','compliance_requisitos'
    ]) as tabla
  loop
    for pol in
      select polname from pg_policy where polrelid = format('public.%I', r.tabla)::regclass
    loop
      execute format('drop policy %I on public.%I', pol.polname, r.tabla);
    end loop;

    execute format('create policy select_active_user on public.%I for select using (is_authenticated_active())', r.tabla);
    execute format('create policy insert_active_user on public.%I for insert with check (is_authenticated_active())', r.tabla);
    execute format('create policy update_active_user on public.%I for update using (is_authenticated_active())', r.tabla);
    execute format('create policy delete_admin_only on public.%I for delete using (is_admin())', r.tabla);
  end loop;
end $$;
