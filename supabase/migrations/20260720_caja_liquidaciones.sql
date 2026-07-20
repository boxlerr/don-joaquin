-- Ingreso a caja consolidado por liquidación de Loma / DM de YPF.
--
-- Decisión de negocio (20/07/2026): el cobro de los fletes NO es viaje por viaje.
-- La plata entra a la caja cuando se carga la liquidación de Loma Negra o el DM
-- de YPF (momento real del cobro por lote). Se genera UN movimiento de caja
-- consolidado por cada liquidación / DM, vinculado por estas columnas para poder
-- desglosar (viajes con ese liq_loma_id / dm_ypf_id) y para borrarlo si se elimina
-- la liquidación (ON DELETE CASCADE).

alter table public.caja_movimientos
  add column if not exists liq_loma_id uuid
    references public.compliance_liq_loma(id) on delete cascade,
  add column if not exists dm_ypf_id uuid
    references public.compliance_dm_ypf(id) on delete cascade;

-- Idempotencia: como mucho un movimiento de caja por liquidación y por DM
-- (evita duplicar el ingreso si se reprocesa el mismo documento).
create unique index if not exists caja_movimientos_liq_loma_uniq
  on public.caja_movimientos(liq_loma_id)
  where liq_loma_id is not null;

create unique index if not exists caja_movimientos_dm_ypf_uniq
  on public.caja_movimientos(dm_ypf_id)
  where dm_ypf_id is not null;
