-- A dónde se manda cada documento de compliance (reunión Nico 02/07).
-- ---------------------------------------------------------------------------
-- Cada requisito puede indicar a qué portales / mails hay que enviar el
-- documento, para que cualquiera pueda hacerlo cuando no está Noelia. Es texto
-- libre editable desde el diálogo de carga; se muestra en el checklist y en
-- las alertas de vencimiento ("vence el 931 → mandar a X, Y, Z").

alter table public.compliance_requisitos
  add column if not exists enviar_a text;

comment on column public.compliance_requisitos.enviar_a is
  'A dónde se presenta/manda el documento (portales o mails, texto libre editable). Se muestra en el checklist y en las alertas de vencimiento.';

-- Destinos del Formulario 931 (tiene tabla propia, no un requisito): parámetro
-- editable. Nico (02/07): el 931 va a SICOP, Secondi y al portal de YPF.
insert into public.parametros_sistema (clave, valor, tipo_dato, categoria, descripcion, editable)
values (
  'form931_enviar_a',
  'SICOP, Secondi y portal de YPF',
  'string',
  'compliance',
  'A dónde se manda el Formulario 931 cada mes. Se muestra en Compliance → F931 y en las alertas de vencimiento.',
  true
)
on conflict (clave) do nothing;
