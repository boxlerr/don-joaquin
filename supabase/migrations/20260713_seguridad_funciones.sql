-- Seguridad (13/07, parte 2): funciones SECURITY DEFINER expuestas por REST.
-- Los advisors de Supabase mostraban que anon podía ejecutar los helpers de
-- RLS (heredado del GRANT EXECUTE a PUBLIC que Postgres da por defecto) y que
-- cualquier usuario logueado podía ejecutar resumen_choferes_mes — la función
-- de la fuga original de la auditoría del 23/06, que ya no se usa en el
-- código (reemplazada en viajes/hoja-ruta/actions.ts).
--
-- Regla: helpers de RLS ejecutables SOLO por authenticated (las políticas los
-- evalúan con los privilegios del rol que consulta); resumen_choferes_mes sin
-- acceso por REST para nadie; y las funciones futuras nacen sin EXECUTE
-- público (hay que grantear explícito).

-- Helpers de RLS: fuera PUBLIC/anon, adentro authenticated
do $$
declare f text;
begin
  foreach f in array array[
    'is_admin()', 'is_authenticated_active()', 'current_user_role_code()',
    'can_read_area(text)', 'can_write_area(text)',
    'current_area_rank(text)', 'current_seccion_rank(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- La función de la fuga original: solo service role
revoke execute on function public.resumen_choferes_mes(date, date) from public, anon, authenticated;

-- Funciones futuras: sin EXECUTE por defecto para public/anon
alter default privileges in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from public;
