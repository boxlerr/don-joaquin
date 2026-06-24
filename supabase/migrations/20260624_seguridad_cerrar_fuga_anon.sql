-- Auditoría 2026-06-24: cerrar fuga de datos al rol anon.
-- Aplicada a producción vía MCP (migración seguridad_cerrar_fuga_anon_20260624).
-- Contexto: 9 vistas SECURITY DEFINER + RPC resumen_choferes_mes exponían datos a anon
-- (v_viaje_resumen devolvía 1609 filas sin login; resumen_choferes_mes filtraba PII + fletes).
-- La tabla de backup viajes_backup_20260623 tenía RLS off y grants de INSERT/DELETE/TRUNCATE a anon.

-- 1) Vistas: ejecutar con permisos del invocador (aplica RLS) en vez del creador.
--    La app las consulta como authenticated (RLS permite a todo usuario activo) → sigue funcionando.
ALTER VIEW public.v_cliente_saldo               SET (security_invoker = true);
ALTER VIEW public.v_factura_saldo               SET (security_invoker = true);
ALTER VIEW public.v_caja_saldo                  SET (security_invoker = true);
ALTER VIEW public.v_camion_km_actual            SET (security_invoker = true);
ALTER VIEW public.v_camion_documentos_vigencia  SET (security_invoker = true);
ALTER VIEW public.v_chofer_documentos_vigencia  SET (security_invoker = true);
ALTER VIEW public.v_cheques_por_vencer          SET (security_invoker = true);
ALTER VIEW public.v_viaje_resumen               SET (security_invoker = true);
ALTER VIEW public.v_compliance_estado           SET (security_invoker = true);

-- 2) Quitar el acceso del rol anónimo a esas vistas (defensa en profundidad).
REVOKE SELECT ON
  public.v_cliente_saldo, public.v_factura_saldo, public.v_caja_saldo,
  public.v_camion_km_actual, public.v_camion_documentos_vigencia,
  public.v_chofer_documentos_vigencia, public.v_cheques_por_vencer,
  public.v_viaje_resumen, public.v_compliance_estado
FROM anon;

-- 3) RPC resumen_choferes_mes: la app ya no la usa; cerrar a anon/PUBLIC, dejar solo authenticated.
REVOKE EXECUTE ON FUNCTION public.resumen_choferes_mes(date, date) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resumen_choferes_mes(date, date) TO authenticated;

-- 4) Tabla de backup: cortar exposición vía PostgREST (datos intactos; el DROP lo decide el equipo).
REVOKE ALL ON public.viajes_backup_20260623 FROM anon, authenticated;
