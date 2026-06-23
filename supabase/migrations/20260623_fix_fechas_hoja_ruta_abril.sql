-- Fix de fechas mal tipeadas en el Excel de Hoja de Ruta (auditoría 22/06).
--
-- Tres viajes del import HOJA DE RUTA quedaron con fechas de otro mes/año porque
-- el Excel del cliente las tenía mal cargadas. Nico confirmó que los tres son de
-- abril 2026. El día está bien; sólo se equivocaron el mes (y en un caso el año
-- implícito por el serial de Excel).
--
--   V-2026-00660  SALTO MAXIMILIANO            2026-02-28 -> 2026-04-28
--   V-2026-01010  DE LIBANO (ARROYITO->L.NEGRA) 2026-07-16 -> 2026-04-16
--   V-2026-01004  DE LIBANO (TANDIL->BARKER)    2026-09-09 -> 2026-04-09
--
-- El WHERE doble (id + fecha_viaje original) hace la migración idempotente:
-- si ya se aplicó, los UPDATE no afectan ninguna fila.

update public.viajes set fecha_viaje = '2026-04-28'
  where id = '1f5d8f88-4fb0-4212-8ffb-7c78541a4a11' and fecha_viaje = '2026-02-28';

update public.viajes set fecha_viaje = '2026-04-16'
  where id = '88c4ffe3-5077-472f-a9de-5a1733ef077a' and fecha_viaje = '2026-07-16';

update public.viajes set fecha_viaje = '2026-04-09'
  where id = '84ccb40b-1b88-4761-bab7-f8ec4b7ec9f2' and fecha_viaje = '2026-09-09';
