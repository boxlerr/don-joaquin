-- Bloqueo de acceso fuera del horario laboral (audios Bárbara 02/07, 1-3).
-- ---------------------------------------------------------------------------
-- Nicolás quiere que el equipo no pueda "mirar los números en un asado":
-- fuera de la franja laboral, los usuarios NO admin ven una pantalla de
-- bloqueo y tienen que pedir autorización. Los admin (Bárbara y Nicolás)
-- entran siempre. El registro de accesos ya existe (audit_log, accion login).
--
-- ARRANCA DESACTIVADO (acceso_horario_activo=false) para no dejar a nadie
-- afuera de sorpresa: se prende desde /configuracion cuando ellos definan la
-- franja. La excepción por usuario ("acceso 24 hs") se tilda en /usuarios.

alter table public.usuarios
  add column if not exists acceso_fuera_horario boolean not null default false;

comment on column public.usuarios.acceso_fuera_horario is
  'Excepción al bloqueo por horario laboral: true = puede entrar 24 hs aunque el bloqueo esté activo.';

insert into public.parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable)
values
  (
    'acceso_horario_activo',
    'false',
    'boolean',
    'seguridad',
    'Bloquear el acceso de los usuarios no administradores fuera del horario laboral. Los administradores entran siempre.',
    true
  ),
  (
    'acceso_hora_desde',
    '06:00',
    'string',
    'seguridad',
    'Desde qué hora se permite entrar al sistema (HH:MM, hora argentina). Solo aplica con el bloqueo activo.',
    true
  ),
  (
    'acceso_hora_hasta',
    '20:00',
    'string',
    'seguridad',
    'Hasta qué hora se permite entrar al sistema (HH:MM, hora argentina). Solo aplica con el bloqueo activo.',
    true
  )
on conflict (clave) do nothing;
