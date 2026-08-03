-- Separa los cheques propios de los recibidos (audio de Bárbara del 03/08).
--
-- Hasta ahora el módulo modelaba un solo tipo de cheque: el que recibimos de un
-- cliente. Un cheque nuestro —el que emite Joaquín Hnos y le entrega a un
-- tercero— entraba por el mismo formulario y quedaba "en cartera", o sea que
-- sumaba a los valores a cobrar cuando en realidad es plata que sale. La única
-- forma de sacarlo de ahí era anularlo, que dice otra cosa.
--
-- Con `origen` cada cheque sabe de qué lado está, y la cartera vuelve a ser
-- sólo lo que nos deben.

create type cheque_origen as enum ('recibido', 'propio');

alter table cheques
  add column origen cheque_origen not null default 'recibido';

comment on column cheques.origen is
  'recibido = nos lo dio un tercero (valor a cobrar). propio = lo emitimos nosotros (valor a pagar).';

-- Estados que sólo tienen sentido para un cheque propio:
--   emitido  = lo hicimos, todavía no salió de nuestro poder
--   debitado = lo cobraron, la plata ya salió de la cuenta
-- (los recibidos siguen con cartera / entregado / depositado / acreditado)
alter type cheque_estado add value if not exists 'emitido';
alter type cheque_estado add value if not exists 'debitado';

-- Los cheques ya cargados quedan como 'recibido' por el default: son los de
-- Loma Negra. El propio de JOAQUIN HNOS SRL cargado el 31/07 quedó anulado y
-- se marca (o se borra) a mano desde la pantalla, no acá.

create index if not exists idx_cheques_origen_estado on cheques (origen, estado);
