-- Libradores — catálogo propio para el alta de cheques.
--
-- Antes la lista de libradores salía de los cheques ya cargados, así que un
-- nombre mal escrito no se podía sacar del desplegable sin borrar el cheque.
-- Ahora es una tabla, igual que `bancos`: lo que se escribe en el campo queda
-- guardado solo y se puede eliminar de la lista sin tocar ningún cheque
-- (`cheques.librador_nombre` sigue siendo texto, no una FK).

create table if not exists public.libradores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  cuit       text,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) on delete set null
);

-- Único sin distinguir mayúsculas: "loma negra" y "Loma Negra" son el mismo.
create unique index if not exists libradores_nombre_unico
  on public.libradores (lower(nombre));

-- Semilla: los libradores que ya se venían usando en los cheques cargados.
insert into public.libradores (nombre, cuit)
select (array_agg(trim(librador_nombre) order by created_at))[1],
       min(nullif(trim(librador_cuit), ''))
  from public.cheques
 where nullif(trim(librador_nombre), '') is not null
 group by lower(trim(librador_nombre))
on conflict do nothing;

-- Loma Negra es el librador habitual: va siempre, aunque todavía no tenga
-- cheques cargados. Desde acá se puede borrar como cualquier otro.
insert into public.libradores (nombre)
select 'Loma Negra'
 where not exists (
   select 1 from public.libradores where lower(nombre) = 'loma negra'
 );

alter table public.libradores enable row level security;

revoke all on public.libradores from anon;

create policy libradores_sel on public.libradores
  for select to authenticated using (can_read_area('finanzas'));

create policy libradores_ins on public.libradores
  for insert to authenticated with check (can_write_area('finanzas'));

create policy libradores_upd on public.libradores
  for update to authenticated
  using (can_write_area('finanzas')) with check (can_write_area('finanzas'));

create policy libradores_del on public.libradores
  for delete to authenticated using (can_write_area('finanzas'));
