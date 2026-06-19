-- Generalizar "roturas de goma" a roturas de cualquier parte.
--
-- Pedido de Bárbara (19/06): no rompen solo gomas (le llegó una factura de un
-- guardabarros). El módulo permitía registrar solo gomas. Agregamos una columna
-- `tipo` para elegir qué se rompió (goma, guardabarros, paragolpes, espejo,
-- óptica, parabrisas, llanta, etc.). Las roturas existentes quedan como 'goma'
-- por compatibilidad. La tabla mantiene el nombre `roturas_gomas` para no romper
-- referencias; conceptualmente ahora es "roturas".
alter table roturas_gomas
  add column if not exists tipo text not null default 'goma';

comment on column roturas_gomas.tipo is
  'Qué se rompió: goma, guardabarros, paragolpes, espejo, optica, parabrisas, llanta, etc. Default goma por compatibilidad.';
