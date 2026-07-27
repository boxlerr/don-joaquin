-- Préstamos: campo aparte para la referencia con que el banco/la planilla
-- identifica al préstamo (ej. "SUECA", "FORTE CAR", "TARJ.PYME NACION").
--
-- Hasta ahora esos nombres entraban en `detalle`, que es la columna del MONTO
-- original. El resultado era que en la tabla aparecía un nombre donde tenía que
-- ir plata. Ahora van a `referencia` y `detalle` queda vacío, que es lo honesto:
-- el monto de esos préstamos todavía no lo tenemos.

alter table public.prestamos
  add column if not exists referencia text;

comment on column public.prestamos.referencia is
  'Nombre con que se identifica al préstamo en la planilla o en el banco (ej. SUECA, FORTE CAR). No es el monto: eso va en detalle.';

-- Los dos casos que ya estaban cargados así.
update public.prestamos
   set referencia = detalle,
       detalle = null
 where banco = 'Nación'
   and detalle in ('SUECA', 'FORTE CAR')
   and referencia is null;

-- Mismo caso, detectado en la revisión: "Plan de pago" (AFIP) y los cuatro
-- "Vencimiento dd/mm/aaaa" de Tarjeta Corpo tampoco son montos.
update public.prestamos
   set referencia = detalle,
       detalle = null
 where referencia is null
   and (
     (banco = 'AFIP' and detalle = 'Plan de pago')
     or (banco = 'Tarjeta Corpo' and detalle like 'Vencimiento %')
   );
