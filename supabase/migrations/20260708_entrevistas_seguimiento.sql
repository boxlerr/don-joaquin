-- Seguimiento del candidato tras la entrevista (columnas del Excel "PERSONAS ENTREVISTADAS").
-- Se guardan textuales, además de los enums preocupacional/resultado del pipeline.
alter table public.entrevistas add column if not exists preocupacional_nota text; -- detalle libre del preocupacional (más allá del enum)
alter table public.entrevistas add column if not exists aprobado text;            -- "APROBADO?" del Excel (texto libre / SI-NO)
alter table public.entrevistas add column if not exists entro text;               -- "ENTRO?" del Excel (texto libre / SI-NO)
alter table public.entrevistas add column if not exists se_mantuvo text;          -- "SE MANTUVO?" del Excel: qué pasó después de que ingresó
