-- RLS por área — extensión a RRHH (entrevistas). 13/07.
-- El módulo /entrevistas accede a la DB SOLO vía service role (verificado
-- archivo por archivo), así que estas políticas no afectan a la app: cierran
-- el acceso directo por REST para usuarios logueados SIN el área rrhh
-- (antes cualquier usuario activo podía leer los candidatos y sus notas).
-- Mismo patrón del piloto de finanzas/caja: can_read_area / can_write_area.

-- entrevistas: cualquier-activo → área rrhh (espeja requireArea del módulo)
drop policy if exists select_active_user on public.entrevistas;
drop policy if exists insert_active_user on public.entrevistas;
drop policy if exists update_active_user on public.entrevistas;
drop policy if exists delete_admin_only on public.entrevistas;
drop policy if exists entrevistas_sel on public.entrevistas;
drop policy if exists entrevistas_ins on public.entrevistas;
drop policy if exists entrevistas_upd on public.entrevistas;
drop policy if exists entrevistas_del on public.entrevistas;
create policy entrevistas_sel on public.entrevistas for select using (can_read_area('rrhh'));
create policy entrevistas_ins on public.entrevistas for insert with check (can_write_area('rrhh'));
create policy entrevistas_upd on public.entrevistas for update using (can_write_area('rrhh'));
create policy entrevistas_del on public.entrevistas for delete using (current_area_rank('rrhh') >= 3);

-- entrevista_archivos (CVs): misma área
drop policy if exists select_active_user on public.entrevista_archivos;
drop policy if exists insert_active_user on public.entrevista_archivos;
drop policy if exists update_active_user on public.entrevista_archivos;
drop policy if exists delete_active_user on public.entrevista_archivos;
drop policy if exists delete_admin_only on public.entrevista_archivos;
drop policy if exists entrevista_archivos_sel on public.entrevista_archivos;
drop policy if exists entrevista_archivos_ins on public.entrevista_archivos;
drop policy if exists entrevista_archivos_del on public.entrevista_archivos;
create policy entrevista_archivos_sel on public.entrevista_archivos for select using (can_read_area('rrhh'));
create policy entrevista_archivos_ins on public.entrevista_archivos for insert with check (can_write_area('rrhh'));
create policy entrevista_archivos_del on public.entrevista_archivos for delete using (can_write_area('rrhh'));
