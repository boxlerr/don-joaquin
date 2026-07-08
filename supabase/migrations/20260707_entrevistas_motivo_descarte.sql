-- Motivo por el que un candidato no se contrató (se muestra en la lista, aparte).
alter table public.entrevistas add column if not exists motivo_descarte text;
