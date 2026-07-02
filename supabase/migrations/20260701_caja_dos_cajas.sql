-- Caja: dos cajas + "operar ≠ ver" (audios Bárbara 30/06, tema 3).
-- ---------------------------------------------------------------------------
-- Bárbara necesita que otros puedan CARGAR movimientos cuando ella no está,
-- sin enterarse del saldo ni de sus retiros, y una "caja grande" aparte que
-- solo ven ella y Nicolás. Modelo:
--   · caja_movimientos.caja: 'diaria' (multiusuario) | 'grande' (dirección).
--   · Transferencias entre cajas = par de movimientos (egreso en una, ingreso
--     en la otra) unidos por transferencia_id, categoría transferencia_interna.
--   · RLS: las filas de la caja grande solo las ve/toca quien tenga la
--     subsección confidencial `caja_grande` (helper current_seccion_rank).
--     El "no ver saldo/historial de la diaria" se resuelve en la app con la
--     subsección `caja_saldo` (los server actions usan service role).

alter table public.caja_movimientos
  add column if not exists caja text not null default 'diaria';

do $$ begin
  alter table public.caja_movimientos
    add constraint caja_movimientos_caja_check check (caja in ('diaria', 'grande'));
exception when duplicate_object then null; end $$;

alter table public.caja_movimientos
  add column if not exists transferencia_id uuid;

comment on column public.caja_movimientos.caja is
  'A qué caja pertenece el movimiento: diaria (operativa, multiusuario) o grande (solo dirección).';
comment on column public.caja_movimientos.transferencia_id is
  'Une el par egreso/ingreso de una transferencia entre cajas (categoría transferencia_interna).';

create index if not exists caja_movimientos_caja_fecha_idx
  on public.caja_movimientos (caja, fecha desc);
create index if not exists caja_movimientos_transferencia_idx
  on public.caja_movimientos (transferencia_id) where transferencia_id is not null;

-- RLS: sumar el guard por fila de la caja grande a las policies por área.
drop policy if exists caja_movimientos_sel on public.caja_movimientos;
create policy caja_movimientos_sel on public.caja_movimientos
  for select to authenticated
  using (
    public.can_read_area('caja')
    and (caja = 'diaria' or public.current_seccion_rank('caja_grande') >= 1)
  );

drop policy if exists caja_movimientos_ins on public.caja_movimientos;
create policy caja_movimientos_ins on public.caja_movimientos
  for insert to authenticated
  with check (
    public.can_write_area('caja')
    and (caja = 'diaria' or public.current_seccion_rank('caja_grande') >= 2)
  );

drop policy if exists caja_movimientos_upd on public.caja_movimientos;
create policy caja_movimientos_upd on public.caja_movimientos
  for update to authenticated
  using (
    public.can_write_area('caja')
    and (caja = 'diaria' or public.current_seccion_rank('caja_grande') >= 2)
  )
  with check (
    public.can_write_area('caja')
    and (caja = 'diaria' or public.current_seccion_rank('caja_grande') >= 2)
  );
