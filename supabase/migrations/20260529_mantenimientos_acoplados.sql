-- ────────────────────────────────────────────────────────────────────────────
-- Mantenimientos sobre acoplados
--
-- Hasta ahora `mantenimientos.camion_id` era NOT NULL, así que solo los chasis
-- podían tener services. Pero un acoplado/semi también va al taller (gomería,
-- cubiertas, frenos del semi). Hacemos `camion_id` nullable y agregamos
-- `acoplado_id`, con un CHECK que exige exactamente UNA de las dos unidades.
--
-- Idempotente.
-- ────────────────────────────────────────────────────────────────────────────

-- 1) camion_id pasa a nullable
alter table public.mantenimientos
  alter column camion_id drop not null;

-- 2) FK a acoplados
alter table public.mantenimientos
  add column if not exists acoplado_id uuid
    references public.acoplados(id) on delete cascade;

create index if not exists mantenimientos_acoplado_idx
  on public.mantenimientos (acoplado_id, fecha desc);

-- 3) Exactamente una unidad (camión XOR acoplado)
do $$ begin
  alter table public.mantenimientos
    add constraint mantenimientos_unidad_unica
    check (
      (camion_id is not null and acoplado_id is null)
      or (camion_id is null and acoplado_id is not null)
    );
exception
  when duplicate_object then null;
end $$;
