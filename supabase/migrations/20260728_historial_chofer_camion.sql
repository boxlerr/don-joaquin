-- El historial chofer↔camión cerraba el período abierto mirando sólo el CAMIÓN.
-- Si a un chofer se lo pasaba del camión A al B asignándole el B directamente
-- (sin liberar antes el A), quedaba con dos camiones "vigentes" a la vez y el
-- historial dejaba de servir.
--
-- Hoy no pasa porque la planilla diaria usa aplicar_planilla_estandar, que
-- primero libera y después asigna. Pero el invariante —un chofer, un camión
-- vigente— tiene que valer para cualquiera que escriba, no sólo para ese
-- camino: una corrección a mano, un import o una pantalla nueva lo romperían
-- sin que nadie se entere.
create or replace function public.tg_sync_chofer_camion_historial()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.chofer_actual_id is not null then
      -- Si el chofer venía manejando otra unidad, ese período se cierra.
      update public.chofer_camion_historial
         set hasta = current_date
       where chofer_id = new.chofer_actual_id and hasta is null;

      insert into public.chofer_camion_historial (chofer_id, camion_id, desde)
      values (new.chofer_actual_id, new.id, current_date);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.chofer_actual_id is distinct from new.chofer_actual_id then
      -- Se cierra por camión (el que se liberó) y por chofer (el que se movió).
      update public.chofer_camion_historial
         set hasta = current_date
       where hasta is null
         and (
           camion_id = new.id
           or (new.chofer_actual_id is not null and chofer_id = new.chofer_actual_id)
         );

      if new.chofer_actual_id is not null then
        insert into public.chofer_camion_historial (chofer_id, camion_id, desde)
        values (new.chofer_actual_id, new.id, current_date);
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.chofer_camion_historial
       set hasta = current_date
     where camion_id = old.id and hasta is null;
    return old;
  end if;

  return null;
end;
$function$;

comment on function public.tg_sync_chofer_camion_historial() is
  'Mantiene chofer_camion_historial al cambiar camiones.chofer_actual_id. Cierra el período abierto tanto del camión que se libera como del chofer que se mueve, para que un chofer nunca tenga dos camiones vigentes.';
