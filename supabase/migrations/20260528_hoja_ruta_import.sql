-- Soporte para import del Excel de hojas de ruta de Bárbara.
--
-- Cambios:
-- 1) hoja_ruta_items.tn_com_29: faltaba la 3ra categoría de tonelaje que viene en
--    el Excel ("TN COM 29"). Las otras dos (esc_35 y esc_37_5) ya existían.
-- 2) hojas_ruta.camion_id: cada sheet del Excel corresponde a un chofer Y a un
--    camión. Hoy hojas_ruta solo tenía chofer; el camión queda registrado para
--    poder reconstruir/validar el detalle (mismo camión todo el período).
-- 3) hojas_ruta.archivo_origen / sheet_origen: trazabilidad del import (qué
--    .xlsx + qué sheet generó esta hoja). Permite re-importar y diagnosticar.
-- 4) Índice único (chofer_id, periodo_desde, periodo_hasta): re-importar el
--    mismo período del mismo chofer debe ser upsert, no duplicado.


alter table public.hoja_ruta_items
  add column if not exists tn_com_29 numeric;

alter table public.hojas_ruta
  add column if not exists camion_id uuid references public.camiones(id) on delete set null,
  add column if not exists archivo_origen text,
  add column if not exists sheet_origen text;

create unique index if not exists hojas_ruta_chofer_periodo_unico
  on public.hojas_ruta (chofer_id, periodo_desde, periodo_hasta);
