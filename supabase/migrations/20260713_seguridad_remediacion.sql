-- Seguridad: remediación de los hallazgos de la auditoría del 23/06 (13/07).
-- La app NUNCA consulta la base como rol `anon` (verificado: el cliente browser
-- solo hace auth + un SELECT a audit_log como `authenticated`; todo lo demás
-- va por server actions con service role o con el JWT del usuario). Por eso:
--
-- 1) viajes_backup_20260623: era la única tabla SIN RLS y con grants a anon
--    → cualquiera con el anon key podía leerla entera. Se blinda.
-- 2) v_compliance_estado: única vista SECURITY DEFINER (bypasseaba RLS).
--    Solo la consume código con service role → pasa a security_invoker y se
--    revoca el acceso directo.
-- 3) anon pierde TODO permiso sobre el schema public (tablas, secuencias,
--    funciones), incluidos los defaults para objetos futuros. Defensa en
--    profundidad: aunque una tabla nueva salga sin RLS, anon no la ve.

-- 1) Backup sin RLS
alter table if exists public.viajes_backup_20260623 enable row level security;
revoke all on table public.viajes_backup_20260623 from anon, authenticated;

-- 2) Vista definer → invoker + sin acceso directo por REST
alter view if exists public.v_compliance_estado set (security_invoker = true);
revoke all on table public.v_compliance_estado from anon, authenticated;

-- 3) anon afuera de public, presente y futuro
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
