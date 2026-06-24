-- Costos de Repuestos y Reparaciones: resumen contable mensual por proveedor
-- (fuente: Excel "rep y rep"). Aplicada vía MCP. Los datos (92 filas ene/feb/mar '26)
-- se cargaron con scripts/import-costos-rep-rep.cjs (SQL idempotente on conflict mes+proveedor).
-- NOTA: este Excel NO es un registro de mantenimientos por unidad; es un resumen contable.
create table if not exists public.costos_rep_rep (
  id                 uuid primary key default gen_random_uuid(),
  mes                date not null,          -- primer día del mes (ej: 2026-01-01)
  proveedor          text not null,
  neto_gravado       numeric not null default 0,  -- "REPUESTOS Y REPARACIONES 21 %" — Importe Neto
  facturado_gravado  numeric not null default 0,  -- "REPUESTOS Y REPARACIONES 21 %" — Importe Facturado
  neto_ng            numeric not null default 0,  -- "REPUESTOS Y REPARACIONES NG" — Importe Neto
  facturado_ng       numeric not null default 0,  -- "REPUESTOS Y REPARACIONES NG" — Importe Facturado
  neto_total         numeric not null default 0,
  facturado_total    numeric not null default 0,
  observaciones      text,
  created_at         timestamptz not null default now(),
  created_by         uuid references public.usuarios(id),
  unique (mes, proveedor)
);

create index if not exists costos_rep_rep_mes_idx on public.costos_rep_rep (mes);

alter table public.costos_rep_rep enable row level security;

-- RLS coherente con el módulo de mantenimiento (is_authenticated_active);
-- en la Fase 2 de RLS-por-área pasa a can_read_area/can_write_area('mantenimiento').
drop policy if exists select_active_user on public.costos_rep_rep;
create policy select_active_user on public.costos_rep_rep for select using (is_authenticated_active());
drop policy if exists insert_active_user on public.costos_rep_rep;
create policy insert_active_user on public.costos_rep_rep for insert with check (is_authenticated_active());
drop policy if exists update_active_user on public.costos_rep_rep;
create policy update_active_user on public.costos_rep_rep for update using (is_authenticated_active()) with check (is_authenticated_active());
drop policy if exists delete_admin_only on public.costos_rep_rep;
create policy delete_admin_only on public.costos_rep_rep for delete using (is_admin());
