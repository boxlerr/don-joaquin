-- Verificación del blindaje de vacaciones (migración 20260729_vacaciones_origen_y_auditoria).
--
-- NO se corre solo: está fuera de supabase/migrations a propósito, para que el
-- runner no lo tome como una migración. Se ejecuta A MANO y SOBRE UNA BRANCH de
-- Supabase, nunca contra producción — todo va dentro de una transacción que
-- termina en rollback, pero el criterio de la casa es no tocar prod con SQL suelto.
--
-- Prueba lo que el requisito promete, que es distinto de que esté escrito:
--   1. un proceso automático NO puede degradar una fila humana;
--   2. un UPDATE que cambia los días sin declarar `updated_at` falla (es la
--      reproducción exacta del script del 22/07/2026 que rompió 14 legajos);
--   3. un UPDATE normal pasa y deja el antes/después en audit_log.

begin;

do $$
declare
  v_chofer uuid;
  v_ok boolean;
  v_anterior text;
  v_fuente text;
  v_filas integer;
begin
  select id into v_chofer from public.choferes limit 1;
  if v_chofer is null then
    raise exception 'La branch no tiene ningún chofer: no se puede probar nada.';
  end if;

  insert into public.chofer_vacaciones_anios (chofer_id, anio, dias_correspondientes, origen, updated_at)
  values (v_chofer, 2025, 28, 'humano', now())
  on conflict (chofer_id, anio) do update
    set dias_correspondientes = 28, origen = 'humano', updated_at = now();

  -- (1) Bajar el origen de una fila humana tiene que explotar.
  v_ok := false;
  begin
    update public.chofer_vacaciones_anios
       set origen = 'antiguedad', dias_correspondientes = 16, updated_at = now()
     where chofer_id = v_chofer and anio = 2025;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLA 1: un proceso automático pudo pisar una fila humana.';
  end if;

  -- (2) Cambiar los días sin mover updated_at tiene que explotar. Es lo que
  --     hacía el `on conflict do update set dias_correspondientes, observaciones`
  --     del script descartable, y por eso no quedó ni la hora del desastre.
  v_ok := false;
  begin
    update public.chofer_vacaciones_anios
       set dias_correspondientes = 16, observaciones = 'saldo + tomados'
     where chofer_id = v_chofer and anio = 2025;
  exception when check_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'FALLA 2: se pudieron cambiar los días sin declarar updated_at.';
  end if;

  -- (3) Un UPDATE normal pasa y queda auditado con el valor viejo.
  update public.chofer_vacaciones_anios
     set dias_correspondientes = 21, updated_at = now()
   where chofer_id = v_chofer and anio = 2025;

  select count(*),
         max(valores_anteriores ->> 'dias_correspondientes'),
         max(metadata ->> 'fuente')
    into v_filas, v_anterior, v_fuente
    from public.audit_log
   where entidad_tipo = 'chofer_vacaciones_anio'
     and entidad_id = v_chofer::text || ':2025'
     and accion = 'vacaciones_db_update';

  if v_filas <> 1 then
    raise exception 'FALLA 3a: se esperaba 1 registro del trigger y hay %.', v_filas;
  end if;
  if v_anterior <> '28' then
    raise exception 'FALLA 3b: el valor anterior auditado es % y tenía que ser 28.', v_anterior;
  end if;
  if v_fuente <> 'trigger_db' then
    raise exception 'FALLA 3c: metadata.fuente es % y tenía que ser trigger_db.', v_fuente;
  end if;

  raise notice 'Blindaje de vacaciones OK: las 3 verificaciones pasaron.';
end $$;

rollback;

-- Después de aplicar la migración conviene correr `get_advisors`: el único
-- hallazgo nuevo esperable es el `security definer` de `tg_audit_vacaciones`,
-- que es necesario porque audit_log tiene INSERT revocado a authenticated desde
-- la remediación del 24/06.
