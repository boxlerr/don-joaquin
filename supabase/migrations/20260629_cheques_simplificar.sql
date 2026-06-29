-- Simplifica el alta de cheques (reunión Nico 29/06): los cheques de Loma Negra
-- son siempre echeq diferidos electrónicos. Solo importan importe, librador
-- (con CUIT) y fecha de vencimiento. Se hacen opcionales el resto de los campos
-- que antes eran obligatorios (número, banco, fechas de emisión/recepción).

alter table cheques alter column numero drop not null;
alter table cheques alter column banco_id drop not null;
alter table cheques alter column fecha_emision drop not null;
alter table cheques alter column fecha_recepcion drop not null;
