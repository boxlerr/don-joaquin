-- Auditoría 2026-06-24: cerrar INSERT/SELECT abiertos a anon/authenticated en
-- audit_log y login_attempts (ahora se escriben con admin client / service_role),
-- y fijar search_path en funciones trigger. Aplicada vía MCP.
-- Cambios de código que acompañan: src/lib/rate-limit.ts y src/lib/audit.ts ahora
-- usan createAdminClient() en vez del server client.

-- a) audit_log: todas las escrituras pasan por service_role (createAdminClient).
DROP POLICY IF EXISTS audit_log_insert_anon ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;
REVOKE INSERT ON public.audit_log FROM anon, authenticated;

-- b) login_attempts: rate-limit.ts ahora lee/escribe con service_role.
DROP POLICY IF EXISTS "Insert from anyone" ON public.login_attempts;
DROP POLICY IF EXISTS "Select for rate limiting" ON public.login_attempts;
REVOKE INSERT, SELECT ON public.login_attempts FROM anon, authenticated;

-- c) search_path fijo en funciones trigger (estaban "mutable"). public, pg_temp
--    para no romper referencias no calificadas dentro de los triggers.
ALTER FUNCTION public.trigger_set_updated_at()            SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_set_updated_at()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_sync_chofer_camion_historial()  SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_sync_viaje_tonelaje_real()      SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_compliance_req_check_tipo_doc()  SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_compliance_dm_ypf_updated_at()  SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_compliance_liq_loma_updated_at() SET search_path = public, pg_temp;
