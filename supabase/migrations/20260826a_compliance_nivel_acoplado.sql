-- Acoplados en Compliance — PASO A: el valor nuevo del enum.
--
-- VA SOLO Y PRIMERO, en su propia corrida. Postgres no deja USAR un valor de
-- enum en la misma transacción en que se agrega: si esto va pegado al paso C,
-- el insert de los requisitos revienta con "unsafe use of new value of enum
-- type". Por eso son dos archivos y no uno.
--
-- Contexto (WhatsApp del 26/08/2026): Noelia intentó cargar la VTV del acoplado
-- y no encontraba la patente. El chasis y el acoplado son dos vehículos con
-- papeles propios —las válvulas de seguridad y el disco de ruptura están en la
-- tolva, no en el tractor— y hasta hoy Compliance sólo conocía chasis.
--
-- `after 'unidad'` deja el orden empresa → unidad → acoplado → chofer, que es el
-- orden en que se leen las tarjetas de la pantalla.

alter type public.compliance_nivel add value if not exists 'acoplado' after 'unidad';
