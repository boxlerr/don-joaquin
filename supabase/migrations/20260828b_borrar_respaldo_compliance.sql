-- ────────────────────────────────────────────────────────────────────────────
-- Seguridad: el respaldo de compliance del 26/08 sale del repo (28/08/2026)
--
-- El paso D (`20260826d_mudar_valvulas_al_acoplado.sql`) abría con una red de
-- seguridad antes de mudar los certificados de válvulas:
--
--     create table if not exists public.compliance_documentos_bkp_20260826 as
--       select * from public.compliance_documentos;
--
-- Una tabla creada así nace SIN RLS —es el default de Postgres— y en esta base
-- todo objeto nuevo de `public` hereda los permisos completos para el rol
-- `authenticated` (así están los default privileges del rol postgres; a `anon`
-- se los sacamos el 13/07). Traducido: una copia entera de compliance legible y
-- escribible por REST para cualquier usuario logueado, salteando el guard de
-- área. El mismo olvido que `impuesto_archivos` el 20/07.
--
-- Lo que hay HOY en la base (verificado el 28/08 contra la base real):
--   • La tabla NO existe: `to_regclass` devuelve null y PostgREST tampoco la ve.
--     La fuga nunca llegó a pasar.
--   • La mudanza SÍ está hecha: los 11 certificados cuelgan del acoplado y
--     ninguno del chasis. La terminó haciendo el paso G, que repite el mismo
--     UPDATE y no crea ningún respaldo.
--
-- O sea que al paso D no le queda trabajo: su UPDATE hoy toca 0 filas y lo único
-- que haría es crear esa copia abierta. Y como respaldo tampoco sirve ya —lo que
-- copiaría es el estado de DESPUÉS de la mudanza, no el de antes—, no hay nada
-- que blindar: se borra.
--
-- Contra la base de hoy esto no cambia nada: son dos no-ops. Sirve para que un
-- rebuild desde cero —que sí replica el paso D— no quede con la tabla colgada,
-- y para que el guardarraíl de `src/lib/rls-migraciones.test.ts` vuelva a verde.
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1) Si en alguna base existe, que no viva ni un minuto abierta: RLS
--       prendida y sin policies, igual que `viajes_backup_20260623` el 13/07.
--       Sin policies, `authenticated` no ve ni una fila; el módulo de compliance
--       trabaja con service role, que bypassea RLS.
alter table if exists public.compliance_documentos_bkp_20260826 enable row level security;

-- ── 2) Y afuera. No hace falta revocarle nada a anon/authenticated: los grants
--       se van con la tabla. Sin `cascade` a propósito: si algo llegara a
--       depender de ella, preferimos que esto se frene y avise.
drop table if exists public.compliance_documentos_bkp_20260826;

-- ── 3) Verificación. Esperado: una fila con `existe = false`.
select to_regclass('public.compliance_documentos_bkp_20260826') is not null as existe;
