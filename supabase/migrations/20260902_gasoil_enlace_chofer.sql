-- El enlace que se le manda al chofer para que anote su propia vuelta.
--
-- Pedido de Julián (02/09/2026): *"un botón para enviar el enlace y que él se lo
-- pase a los choferes y lo llenen, bien fácil, sencillo e intuitivo para
-- cualquier chofer que no se lleva muy bien con la tecnología, así nos evitamos
-- tener que hacerle cuentas a todos"*.
--
-- La decisión de fondo: **un solo enlace para los 61**, no uno por persona. Se
-- manda una vez al grupo de WhatsApp y listo. El costo es que el chofer tiene
-- que elegirse a sí mismo de una lista; eso lo resuelve la pantalla guardando
-- quién es en el teléfono, así lo elige una sola vez en la vida.
--
-- Lo que el chofer carga entra DIRECTO como autorización, no queda esperando el
-- OK de nadie: si tuviera que esperar, el chofer se queda parado en la playa y
-- el enlace no le sirve para lo único que se hizo — enterarse solo de cuántos
-- litros puede cargar.
--
-- Cómo se protege, ya que la URL es pública:
--   * El token es la llave y no se adivina (24 hex = 96 bits).
--   * Se puede apagar y rotar desde la pantalla, sin tocar la base.
--   * El servidor no le cree nada al navegador: rehace la cuenta con la tarifa
--     vigente, verifica que el chofer siga activo y que el tramo exista.
--   * Hay tope diario por persona y descarte de repetidas (ver actions.ts).
--
-- RLS: nace cerrada (RLS on, cero policies). Todo pasa por acciones del servidor
-- con service role; con la anon key no se lee ni se escribe nada. Mismo criterio
-- que gasoil_tarifas y gasoil_autorizaciones.

-- ── 1) El enlace ─────────────────────────────────────────────────────────────

create table if not exists gasoil_enlace (
  id           uuid primary key default gen_random_uuid(),
  -- La llave que va en la URL: /gasoil/<token>
  token        text not null unique check (length(token) >= 16),
  -- Se apaga sin borrar la fila: hay que poder saber qué enlace estuvo vivo y
  -- cuándo, si algún día aparece una vuelta anotada que nadie reconoce.
  activo       boolean not null default true,
  nota         text,
  created_at   timestamptz not null default now(),
  created_by   uuid references usuarios(id) on delete set null,
  revocado_at  timestamptz,
  revocado_by  uuid references usuarios(id) on delete set null
);

comment on table gasoil_enlace is
  'Enlace público para que los choferes anoten su vuelta sin tener cuenta. Se genera y se rota desde /combustible/autoconsumo.';

-- Un solo enlace vivo a la vez. Si hiciera falta rotarlo, se apaga el anterior y
-- se crea otro — nunca dos activos, que sería no saber cuál está circulando.
create unique index if not exists gasoil_enlace_unico_activo
  on gasoil_enlace (activo) where activo;

-- ── 2) De dónde vino la autorización ─────────────────────────────────────────

-- Sin esta columna, una vuelta que anotó el chofer y una que cargó la oficina se
-- ven idénticas en la pantalla. Importa: `created_by` queda en NULL cuando la
-- carga el chofer (no hay usuario), y "sin usuario" es ambiguo — también lo
-- están las filas viejas importadas.
alter table gasoil_autorizaciones
  add column if not exists cargada_por_chofer boolean not null default false;

comment on column gasoil_autorizaciones.cargada_por_chofer is
  'true = la anotó el propio chofer desde el enlace público. false = la cargó alguien de la oficina.';

-- ── 3) El primer enlace, ya generado ─────────────────────────────────────────
-- Se siembra acá para que el botón "Enviar el enlace" tenga algo que mostrar el
-- primer día, sin que nadie tenga que acordarse de generarlo. Idempotente: si ya
-- hay uno activo, no crea otro.

insert into gasoil_enlace (token, nota)
select encode(gen_random_bytes(12), 'hex'), 'Generado por la migración del 02/09/2026'
where not exists (select 1 from gasoil_enlace where activo);

-- ── 4) RLS ───────────────────────────────────────────────────────────────────

alter table gasoil_enlace enable row level security;

-- ── 5) Verificación. Esperado: una fila activa con un token de 24 caracteres. ─

select token, length(token) as largo, activo, created_at from gasoil_enlace;
