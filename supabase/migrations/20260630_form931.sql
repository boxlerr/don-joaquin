-- Formulario 931 (Compliance). Pedido en la reunión con Nico del 29/06.
-- ---------------------------------------------------------------------------
-- El F931 (DDJJ de aportes/contribuciones de seguridad social, AFIP) debe
-- enviarse cada mes a DOS plataformas: Nico lo manda a YPF y Noelia a Loma Negra.
-- Es BLOQUEANTE: sin 931 presentado no puede cargar nadie. Si no se envió antes
-- de la fecha límite, salta alerta a todos (categoría "Compliance Loma/YPF").
-- Modelo: una fila por período, con una fecha límite y dos marcas de envío.

create table if not exists form931_presentaciones (
  id uuid primary key default gen_random_uuid(),
  periodo text not null,                 -- período devengado, ej "2026-06"
  fecha_limite date not null,            -- fecha tope para enviarlo a los clientes
  enviado_ypf boolean not null default false,
  enviado_ypf_at timestamptz,
  enviado_ypf_por uuid references usuarios(id),
  enviado_loma boolean not null default false,
  enviado_loma_at timestamptz,
  enviado_loma_por uuid references usuarios(id),
  observaciones text,
  created_by uuid references usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (periodo)
);

create index if not exists idx_form931_fecha on form931_presentaciones (fecha_limite);
create index if not exists idx_form931_pendiente
  on form931_presentaciones (fecha_limite)
  where not (enviado_ypf and enviado_loma);

-- RLS: solo service role (las server actions usan admin client y validan permiso
-- de área "compliance"). Sin políticas permisivas → cerrado a anon/authenticated.
alter table form931_presentaciones enable row level security;

comment on table form931_presentaciones is
  'Formulario 931 (Compliance): checklist de envío a YPF (Nico) y Loma (Noelia) + alertas de vencimiento. Bloqueante: sin 931 no carga nadie.';

-- Seed: el próximo F931 (devengado 06/2026) vence el 13/07/2026.
insert into form931_presentaciones (periodo, fecha_limite)
values ('2026-06', '2026-07-13')
on conflict (periodo) do nothing;
