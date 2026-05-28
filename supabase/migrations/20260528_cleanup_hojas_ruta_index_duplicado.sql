-- El índice único sobre (chofer_id, periodo_desde, periodo_hasta) ya existía
-- como CONSTRAINT hojas_ruta_chofer_id_periodo_desde_periodo_hasta_key.
-- La migration anterior creó un duplicado redundante. Lo borramos.

drop index if exists public.hojas_ruta_chofer_periodo_unico;
