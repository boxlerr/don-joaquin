-- Roturas: distinguir leve de grave (§12, planilla de Bárbara)
-- Creado: 30/06/2026
--
-- Hasta ahora todas las roturas que no son gomas contaban como "leves" en el
-- score (criterios.ts: descuentoRoturasVarias ya pondera graves > leves, pero no
-- había de dónde sacar la gravedad). Agregamos el campo para marcarlo al cargar.
--
-- Solo aplica a roturas varias (caja volcadora por mal uso = grave; un rayón =
-- leve). En las gomas el valor es indistinto (no pesa en ese concepto del score).
-- Default 'leve' → las roturas ya cargadas siguen contando igual que antes.

alter table public.roturas_gomas
  add column if not exists gravedad text not null default 'leve';

alter table public.roturas_gomas
  drop constraint if exists roturas_gomas_gravedad_chk;
alter table public.roturas_gomas
  add constraint roturas_gomas_gravedad_chk check (gravedad in ('leve', 'grave'));
