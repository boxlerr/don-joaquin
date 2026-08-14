-- Una fecha de vacaciones que no se sabe tiene que poder quedar como no sabida
-- (video de Bárbara del 29/07/2026: "que me ponga tres semanas en febrero… si
-- yo pongo la fecha incierta, que siga incierta").
--
-- Hasta ahora sólo se podían cargar fechas exactas. Para los períodos que se
-- reconstruyeron del Excel —donde el comentario decía "una semana en julio" sin
-- precisar cuál— se eligió un día de arranque y se dejó constancia escribiendo
-- "FECHA ESTIMADA" adentro de las observaciones. La pantalla del legajo busca
-- ese texto con una expresión regular para dibujar el "~".
--
-- Eso funciona de casualidad: si alguien reescribe la observación, el período
-- pasa a afirmar una precisión que el dato no tiene, y nadie se entera. Además
-- no hay forma de cargar una fecha aproximada nueva: el texto lo escribimos
-- nosotros al importar, no está en ningún formulario.
--
-- La cantidad de días sigue siendo firme —eso es lo que ella marcó— así que el
-- saldo, el cronograma y el conteo no cambian. Lo único que se vuelve explícito
-- es CUÁNDO.

alter table chofer_ausencias
  add column if not exists fecha_aproximada boolean not null default false;

comment on column chofer_ausencias.fecha_aproximada is
  'true = las fechas son una ubicación nuestra dentro del mes, no un dato del empleador. La cantidad de días sí es firme.';

-- Pasa a columna lo que hoy vive como convención de texto. Idempotente: se
-- puede correr de nuevo sin efecto.
update chofer_ausencias
   set fecha_aproximada = true
 where fecha_aproximada = false
   and observaciones ~* '(FECHA ESTIMADA|AÑO ESTIMADO)';

-- El cronograma y la vista global filtran por rango de fechas y por chofer; el
-- flag se lee siempre junto con la fila, así que no necesita índice propio.
