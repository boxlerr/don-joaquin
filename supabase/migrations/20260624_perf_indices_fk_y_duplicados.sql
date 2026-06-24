-- Auditoría 2026-06-24: índices en FKs sin cobertura (foco viajes/caja_movimientos)
-- y eliminación de 3 pares de índices duplicados. Aplicada vía MCP.

-- viajes
CREATE INDEX IF NOT EXISTS idx_viajes_created_by    ON public.viajes (created_by);
CREATE INDEX IF NOT EXISTS idx_viajes_destino_id    ON public.viajes (destino_id);
CREATE INDEX IF NOT EXISTS idx_viajes_origen_id     ON public.viajes (origen_id);
CREATE INDEX IF NOT EXISTS idx_viajes_ruta_id       ON public.viajes (ruta_id);
CREATE INDEX IF NOT EXISTS idx_viajes_tarifa_id     ON public.viajes (tarifa_id);
CREATE INDEX IF NOT EXISTS idx_viajes_tipo_carga_id ON public.viajes (tipo_carga_id);

-- caja_movimientos
CREATE INDEX IF NOT EXISTS idx_caja_mov_carga_combustible_id ON public.caja_movimientos (carga_combustible_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_cheque_id            ON public.caja_movimientos (cheque_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_chofer_id            ON public.caja_movimientos (chofer_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_created_by           ON public.caja_movimientos (created_by);
CREATE INDEX IF NOT EXISTS idx_caja_mov_factura_id           ON public.caja_movimientos (factura_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_gasto_id             ON public.caja_movimientos (gasto_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_mantenimiento_id     ON public.caja_movimientos (mantenimiento_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_pago_cliente_id      ON public.caja_movimientos (pago_cliente_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_siniestro_id         ON public.caja_movimientos (siniestro_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_viatico_id           ON public.caja_movimientos (viatico_id);

-- Índices duplicados: se conserva uno de cada par.
DROP INDEX IF EXISTS public.idx_caja_fecha;               -- queda idx_caja_movimientos_fecha
DROP INDEX IF EXISTS public.idx_notificaciones_alerta;    -- queda idx_notificaciones_alerta_id
DROP INDEX IF EXISTS public.idx_audit_log_usuario_created; -- queda idx_audit_log_usuario_fecha
