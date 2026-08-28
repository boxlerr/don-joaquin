-- ────────────────────────────────────────────────────────────────────────────
-- Impuestos: cuánto se pagó (mamá de Bárbara, 27/08/2026)
--
-- La pantalla contestaba "¿lo presenté?" y nunca "¿cuánto pagué?".
-- `impuesto_vencimientos` no tenía una sola columna de plata: el calendario
-- servía para no llegar tarde, pero para saber cuánto se fue en impuestos en el
-- mes había que ir a buscarlo afuera del sistema.
--
-- Dos columnas, las dos opcionales:
--
--   · `importe`    — cuánto se pagó. Se carga cuando se paga, no al programar
--                    el vencimiento: el día que se agenda todavía no se sabe.
--   · `fecha_pago` — CUÁNDO se pagó, que NO es la fecha de presentación. Se
--                    presenta la declaración y se paga, y las dos fechas se
--                    separan seguido. `fecha_presentacion` ya existía y se
--                    queda como está.
--
-- Nullable a propósito: los 11 impuestos cargados no tienen importe y no lo van
-- a tener retroactivamente. Un 0 por default sería peor que un vacío — diría
-- "se pagó cero" donde la verdad es "no lo sabemos", y el total del mes saldría
-- mal sin que se note. La pantalla cuenta aparte cuántos están sin cargar.
--
-- Es aditiva: el código viejo no mira estas columnas y sigue andando igual.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.impuesto_vencimientos
  add column if not exists importe    numeric(14, 2),
  add column if not exists fecha_pago date;

comment on column public.impuesto_vencimientos.importe is
  'Cuánto se pagó, en pesos. Null = todavía no se cargó (no es cero).';
comment on column public.impuesto_vencimientos.fecha_pago is
  'Cuándo se pagó. Distinta de fecha_presentacion: se presenta y se paga por separado.';
