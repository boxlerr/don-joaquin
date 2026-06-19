-- Permitir registrar una rotura con SOLO el chofer (sin unidad).
--
-- Pedido (19/06): al registrar una rotura se debe poder elegir solo el chofer,
-- solo el camión/acoplado, o la combinación. El check `roturas_gomas_unidad_requerida`
-- exigía sí o sí camión o acoplado, por lo que el caso "solo chofer" (que el
-- formulario permitía) fallaba en la base. Ahora basta con cualquiera de los tres.
alter table public.roturas_gomas drop constraint if exists roturas_gomas_unidad_requerida;
alter table public.roturas_gomas add constraint roturas_gomas_unidad_requerida
  check (camion_id is not null or acoplado_id is not null or chofer_id is not null);
