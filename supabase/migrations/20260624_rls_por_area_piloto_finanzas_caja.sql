-- Piloto RLS por área: tablas financieras. Aplicada vía MCP.
-- Reemplaza las policies genéricas (*_active_user / delete_admin_only) por policies que usan
-- la matriz (can_read_area/can_write_area). El admin client (service_role) bypassea RLS, así que
-- los server actions no se afectan; sólo se cierra el acceso directo del browser/PostgREST.
-- DELETE para área-admin (rank>=3). Tablas de cobranza: lectura caja|comercial, escritura caja.

-- caja_movimientos → caja
drop policy if exists select_active_user on public.caja_movimientos;
drop policy if exists insert_active_user on public.caja_movimientos;
drop policy if exists update_active_user on public.caja_movimientos;
drop policy if exists delete_admin_only on public.caja_movimientos;
create policy caja_movimientos_sel on public.caja_movimientos for select to authenticated using (public.can_read_area('caja'));
create policy caja_movimientos_ins on public.caja_movimientos for insert to authenticated with check (public.can_write_area('caja'));
create policy caja_movimientos_upd on public.caja_movimientos for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy caja_movimientos_del on public.caja_movimientos for delete to authenticated using (public.current_area_rank('caja') >= 3);

-- viaticos → caja
drop policy if exists select_active_user on public.viaticos;
drop policy if exists insert_active_user on public.viaticos;
drop policy if exists update_active_user on public.viaticos;
drop policy if exists delete_admin_only on public.viaticos;
create policy viaticos_sel on public.viaticos for select to authenticated using (public.can_read_area('caja'));
create policy viaticos_ins on public.viaticos for insert to authenticated with check (public.can_write_area('caja'));
create policy viaticos_upd on public.viaticos for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy viaticos_del on public.viaticos for delete to authenticated using (public.current_area_rank('caja') >= 3);

-- gastos → finanzas
drop policy if exists select_active_user on public.gastos;
drop policy if exists insert_active_user on public.gastos;
drop policy if exists update_active_user on public.gastos;
drop policy if exists delete_admin_only on public.gastos;
create policy gastos_sel on public.gastos for select to authenticated using (public.can_read_area('finanzas'));
create policy gastos_ins on public.gastos for insert to authenticated with check (public.can_write_area('finanzas'));
create policy gastos_upd on public.gastos for update to authenticated using (public.can_write_area('finanzas')) with check (public.can_write_area('finanzas'));
create policy gastos_del on public.gastos for delete to authenticated using (public.current_area_rank('finanzas') >= 3);

-- cheques → finanzas
drop policy if exists select_active_user on public.cheques;
drop policy if exists insert_active_user on public.cheques;
drop policy if exists update_active_user on public.cheques;
drop policy if exists delete_admin_only on public.cheques;
create policy cheques_sel on public.cheques for select to authenticated using (public.can_read_area('finanzas'));
create policy cheques_ins on public.cheques for insert to authenticated with check (public.can_write_area('finanzas'));
create policy cheques_upd on public.cheques for update to authenticated using (public.can_write_area('finanzas')) with check (public.can_write_area('finanzas'));
create policy cheques_del on public.cheques for delete to authenticated using (public.current_area_rank('finanzas') >= 3);

-- cheque_movimientos → finanzas
drop policy if exists select_active_user on public.cheque_movimientos;
drop policy if exists insert_active_user on public.cheque_movimientos;
drop policy if exists update_active_user on public.cheque_movimientos;
drop policy if exists delete_admin_only on public.cheque_movimientos;
create policy cheque_movimientos_sel on public.cheque_movimientos for select to authenticated using (public.can_read_area('finanzas'));
create policy cheque_movimientos_ins on public.cheque_movimientos for insert to authenticated with check (public.can_write_area('finanzas'));
create policy cheque_movimientos_upd on public.cheque_movimientos for update to authenticated using (public.can_write_area('finanzas')) with check (public.can_write_area('finanzas'));
create policy cheque_movimientos_del on public.cheque_movimientos for delete to authenticated using (public.current_area_rank('finanzas') >= 3);

-- cheque_historial_estado → finanzas (solo lectura; lo escribe service_role)
drop policy if exists "Historial cheques: insertar service_role" on public.cheque_historial_estado;
drop policy if exists "Historial cheques: lectura autenticados" on public.cheque_historial_estado;
create policy cheque_historial_sel on public.cheque_historial_estado for select to authenticated using (public.can_read_area('finanzas'));

-- cta_cte_movimientos → lectura caja|comercial, escritura caja
drop policy if exists select_active_user on public.cta_cte_movimientos;
drop policy if exists insert_active_user on public.cta_cte_movimientos;
drop policy if exists update_active_user on public.cta_cte_movimientos;
drop policy if exists delete_admin_only on public.cta_cte_movimientos;
create policy cta_cte_sel on public.cta_cte_movimientos for select to authenticated using (public.can_read_area('caja') or public.can_read_area('comercial'));
create policy cta_cte_ins on public.cta_cte_movimientos for insert to authenticated with check (public.can_write_area('caja'));
create policy cta_cte_upd on public.cta_cte_movimientos for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy cta_cte_del on public.cta_cte_movimientos for delete to authenticated using (public.current_area_rank('caja') >= 3);

-- pagos_cliente → lectura caja|comercial, escritura caja
drop policy if exists select_active_user on public.pagos_cliente;
drop policy if exists insert_active_user on public.pagos_cliente;
drop policy if exists update_active_user on public.pagos_cliente;
drop policy if exists delete_admin_only on public.pagos_cliente;
create policy pagos_cliente_sel on public.pagos_cliente for select to authenticated using (public.can_read_area('caja') or public.can_read_area('comercial'));
create policy pagos_cliente_ins on public.pagos_cliente for insert to authenticated with check (public.can_write_area('caja'));
create policy pagos_cliente_upd on public.pagos_cliente for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy pagos_cliente_del on public.pagos_cliente for delete to authenticated using (public.current_area_rank('caja') >= 3);

-- pago_cliente_detalle → lectura caja|comercial, escritura caja
drop policy if exists select_active_user on public.pago_cliente_detalle;
drop policy if exists insert_active_user on public.pago_cliente_detalle;
drop policy if exists update_active_user on public.pago_cliente_detalle;
drop policy if exists delete_admin_only on public.pago_cliente_detalle;
create policy pago_det_sel on public.pago_cliente_detalle for select to authenticated using (public.can_read_area('caja') or public.can_read_area('comercial'));
create policy pago_det_ins on public.pago_cliente_detalle for insert to authenticated with check (public.can_write_area('caja'));
create policy pago_det_upd on public.pago_cliente_detalle for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy pago_det_del on public.pago_cliente_detalle for delete to authenticated using (public.current_area_rank('caja') >= 3);

-- pago_cliente_imputaciones → lectura caja|comercial, escritura caja
drop policy if exists select_active_user on public.pago_cliente_imputaciones;
drop policy if exists insert_active_user on public.pago_cliente_imputaciones;
drop policy if exists update_active_user on public.pago_cliente_imputaciones;
drop policy if exists delete_admin_only on public.pago_cliente_imputaciones;
create policy pago_imp_sel on public.pago_cliente_imputaciones for select to authenticated using (public.can_read_area('caja') or public.can_read_area('comercial'));
create policy pago_imp_ins on public.pago_cliente_imputaciones for insert to authenticated with check (public.can_write_area('caja'));
create policy pago_imp_upd on public.pago_cliente_imputaciones for update to authenticated using (public.can_write_area('caja')) with check (public.can_write_area('caja'));
create policy pago_imp_del on public.pago_cliente_imputaciones for delete to authenticated using (public.current_area_rank('caja') >= 3);
