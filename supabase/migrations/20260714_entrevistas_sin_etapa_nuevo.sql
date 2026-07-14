-- Entrevistas: chau etapa "nuevo" (feedback Julián 14/07). El flujo real
-- arranca en la entrevista: entrevista → preocupacional → ingresó/descartado.
-- La columna "Nuevo" del tablero vivía siempre vacía.

update public.entrevistas set etapa = 'entrevista' where etapa = 'nuevo';

alter table public.entrevistas alter column etapa set default 'entrevista';

-- El check queda permisivo con 'nuevo' por si alguna fila vieja se restaura,
-- pero la app ya no lo ofrece ni lo crea.
