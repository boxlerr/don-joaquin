-- Lo que el chofer dice que cargó, para poder mostrarle cuánto le queda.
--
-- Pedido de Nico por WhatsApp (02/09/2026), textual: *"lo que nos faltaría es que
-- ellos ahí puedan cargar los litros previos que cargaron antes de cargar la
-- arena y que puedan después ir viendo cuántos litros le quedan a medida que van
-- cargando gasoil"*.
--
-- **Por qué una tabla nueva y no una columna en `cargas_combustible`.**
-- `cargas_combustible` es el registro OFICIAL: sale del reporte de YPF, tiene
-- remito, importe y precio, y exige `camion_id` y `km_odometro` — dos cosas que
-- el chofer no tiene a mano parado en el surtidor. Pero el motivo de fondo no es
-- técnico: **lo que dice el chofer y lo que dice YPF son dos afirmaciones
-- distintas y tienen que poder no coincidir.** Mezclarlas en la misma tabla
-- borra justamente el dato que hace falta para conciliar. Es el mismo criterio
-- con el que el Excel de Nico separa "TN cargadas según chofer" de "TN
-- descargadas según DM".
--
-- El reporte de YPF llega a día vencido, así que durante el día el saldo que ve
-- el chofer es el que él mismo escribió. Al otro día, cuando entra el import, se
-- puede cruzar. Esa diferencia es información, no un problema a esconder.
--
-- RLS: nace cerrada (RLS on, cero policies). Todo pasa por acciones del servidor
-- con service role. Mismo criterio que el resto del módulo.

create table if not exists gasoil_cargas_declaradas (
  id               uuid primary key default gen_random_uuid(),
  -- Cuelga de la vuelta: el saldo es POR VUELTA, no del día. Un chofer que hace
  -- dos vueltas tiene dos asignaciones distintas y no se pisan.
  -- `on delete cascade` porque una carga sin su vuelta no significa nada: si la
  -- oficina borra una autorización mal cargada, se van sus cargas con ella.
  autorizacion_id  uuid not null references gasoil_autorizaciones(id) on delete cascade,
  litros           numeric(10,2) not null check (litros > 0),
  -- true = los que ya traía cargados antes de cargar la arena. Se anotan al
  -- mismo tiempo que la vuelta y por eso hay que poder distinguirlos: no son una
  -- carga que hizo durante el viaje.
  previa           boolean not null default false,
  observaciones    text,
  created_at       timestamptz not null default now(),
  -- NULL = la anotó el propio chofer desde el enlace, que no tiene usuario.
  created_by       uuid references usuarios(id) on delete set null
);

comment on table gasoil_cargas_declaradas is
  'Litros que el chofer declara haber cargado, contra una autorización. NO es el registro oficial: ese es cargas_combustible, que sale del reporte de YPF a día vencido. Sirve para mostrarle el saldo en el momento y para conciliar después.';

-- El saldo se arma leyendo todas las cargas de una vuelta: ese es el acceso que
-- hay que hacer barato.
create index if not exists gasoil_cargas_declaradas_autorizacion_idx
  on gasoil_cargas_declaradas (autorizacion_id, created_at);

alter table gasoil_cargas_declaradas enable row level security;

-- ── Verificación. Esperado: la tabla vacía y con RLS prendida. ───────────────

select
  (select count(*) from gasoil_cargas_declaradas) as cargas_declaradas,
  (select relrowsecurity from pg_class where relname = 'gasoil_cargas_declaradas') as rls_prendida;
