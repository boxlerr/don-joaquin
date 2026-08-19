-- Seguridad: RLS en `impuesto_archivos` (aviso de Supabase del 17/08).
--
-- Qué pasó: la migración `20260720_impuestos_presentacion_archivos.sql` creó la
-- tabla puente de adjuntos de impuestos y se olvidó de prender RLS. Es la única
-- tabla de public que quedó sin RLS, y por eso el linter la marca como
-- `rls_disabled_in_public` (ERROR).
--
-- Alcance real de la fuga: NO fue pública. La remediación del 13/07 dejó a `anon`
-- sin ningún grant en public (presente y futuro, vía `alter default privileges`),
-- así que sin login no se llegaba. Lo que sí quedó abierto es el rol
-- `authenticated`: cualquier usuario logueado podía leer/escribir/borrar la tabla
-- por REST, salteando el guard de área del módulo. La tabla estaba en 0 filas.
--
-- Fix: RLS prendida y SIN policies, igual que su tabla madre
-- `impuesto_vencimientos`. Todo el módulo de impuestos (`impuestos/actions.ts` y
-- `lib/adjuntos-server.ts`) trabaja con service role, que bypassea RLS → cero
-- impacto en la app y la tabla deja de existir para el resto.
alter table if exists public.impuesto_archivos enable row level security;

-- Las de abajo YA tienen RLS en la base (se prendió a mano en su momento), pero
-- nunca quedó escrito en una migración: un rebuild desde cero las levantaba sin
-- RLS. Son idempotentes; acá sólo cierran esa diferencia entre repo y base.
alter table if exists public.apercibimiento_archivos enable row level security;
alter table if exists public.chofer_documento_archivos enable row level security;
alter table if exists public.camion_documento_archivos enable row level security;
alter table if exists public.compliance_documento_archivos enable row level security;
alter table if exists public.rotacion_bajas enable row level security;
alter table if exists public.rotacion_anual enable row level security;
