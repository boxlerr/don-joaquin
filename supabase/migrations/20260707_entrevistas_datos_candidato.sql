-- Más datos del candidato en Entrevistas (además del CV adjunto ya agregado).
alter table public.entrevistas add column if not exists dni text;
alter table public.entrevistas add column if not exists email text;
alter table public.entrevistas add column if not exists puesto text;   -- a qué puesto/rol aplica
alter table public.entrevistas add column if not exists experiencia text; -- experiencia previa (texto libre)
