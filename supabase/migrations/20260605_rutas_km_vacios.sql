-- Circuitos predefinidos: km vacíos por ruta.
--
-- Una "ruta" ya modela un circuito dirigido (origen → destino) con sus km
-- cargados (km_oficiales). Faltaba guardar los km vacíos típicos del retorno
-- (ej. "voy a Pacheco y siempre vuelvo vacío" => km_vacios = distancia de vuelta).
--
-- Es un valor por defecto del circuito: al cargar un viaje se autocompleta y
-- el operador puede ajustarlo (override puntual). Default 0 para no afectar a
-- las rutas existentes ni a Tarifas, que ya consume esta tabla.

ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS km_vacios integer NOT NULL DEFAULT 0;
