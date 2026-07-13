-- Entrevistas: semáforo de valoración de Bárbara (8vo feedback 08/07:
-- "me gustó / más o menos / no me gustó" clickeable, independiente de la
-- etapa del pipeline) + contacto de emergencia del candidato.

alter table public.entrevistas
  add column if not exists valoracion text,
  add column if not exists contacto_emergencia text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'entrevistas_valoracion_check') then
    alter table public.entrevistas add constraint entrevistas_valoracion_check
      check (valoracion is null or valoracion in ('me_gusto', 'medio', 'no_gusto'));
  end if;
end $$;

comment on column public.entrevistas.valoracion is
  'Semáforo de Bárbara: me_gusto (verde) / medio (amarillo) / no_gusto (rojo). Null = sin valorar.';
comment on column public.entrevistas.contacto_emergencia is
  'Contacto de emergencia del candidato (nombre y teléfono, texto libre).';
