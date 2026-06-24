-- Ítem 2 (decisión 24/06): flujo fiscal simple (sin Nº factura/IVA/CPE) → se dropean las
-- tablas fiscales huérfanas. Aplicada vía MCP. Se conservan hojas_ruta/hoja_ruta_items
-- por una eventual liquidación al chofer persistida.
-- Colaterales: la vista v_factura_saldo (depende de viaje_facturas, sin uso) y las columnas
-- factura_id sin uso (solo figuraban en HIDDEN_KEYS de la auditoría).

drop view if exists public.v_factura_saldo;

alter table public.caja_movimientos          drop column if exists factura_id;
alter table public.cheques                    drop column if exists factura_id;
alter table public.cta_cte_movimientos        drop column if exists factura_id;
alter table public.pago_cliente_imputaciones  drop column if exists factura_id;

drop table if exists public.viaje_facturas;
drop table if exists public.viaje_remitos;
drop table if exists public.viaje_cartas_porte;
