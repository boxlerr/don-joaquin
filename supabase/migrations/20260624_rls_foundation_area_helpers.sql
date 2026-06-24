-- Fundación para RLS por área: funciones que replican la matriz rol_areas + usuario_areas
-- (mismo criterio que src/lib/auth.ts getCurrentUser). Aplicada vía MCP.
-- INERTES por sí solas: recién segregan cuando se enganchan en las policies de cada tabla.

create or replace function public.nivel_rank(p_nivel text)
returns int language sql immutable
set search_path = public, pg_temp as $$
  select case p_nivel
    when 'admin' then 3
    when 'write' then 2
    when 'read'  then 1
    else 0
  end;
$$;

-- Rango efectivo del usuario actual (auth.uid()) para un área:
-- admin => 3; si no, max(nivel del rol, overrides vigentes del usuario). nivel es enum area_nivel.
create or replace function public.current_area_rank(p_area text)
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  with me as (
    select u.id, u.estado, r.codigo as rol_codigo, u.rol_id
    from public.usuarios u
    join public.roles r on r.id = u.rol_id
    where u.id = auth.uid()
  )
  select case
    when not exists (select 1 from me) then 0
    when (select estado from me) <> 'activo' then 0
    when (select rol_codigo from me) = 'admin' then 3
    else greatest(
      coalesce((select public.nivel_rank(nivel::text) from public.rol_areas
                where rol_id = (select rol_id from me) and area_codigo = p_area), 0),
      coalesce((select max(public.nivel_rank(nivel::text)) from public.usuario_areas
                where usuario_id = (select id from me) and area_codigo = p_area
                  and (vence_en is null or vence_en > now())), 0)
    )
  end;
$$;

create or replace function public.can_read_area(p_area text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$ select public.current_area_rank(p_area) >= 1; $$;

create or replace function public.can_write_area(p_area text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$ select public.current_area_rank(p_area) >= 2; $$;

revoke execute on function public.nivel_rank(text)        from anon, public;
revoke execute on function public.current_area_rank(text) from anon, public;
revoke execute on function public.can_read_area(text)     from anon, public;
revoke execute on function public.can_write_area(text)    from anon, public;
grant execute on function public.current_area_rank(text)  to authenticated;
grant execute on function public.can_read_area(text)      to authenticated;
grant execute on function public.can_write_area(text)     to authenticated;
grant execute on function public.nivel_rank(text)         to authenticated;
