-- Pedido textual de Bárbara (punto 16): ciudad de nacimiento Y de residencia separadas.
-- Hoy `localidad` se usa como residencia. Agregamos `ciudad_nacimiento` aparte.
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS ciudad_nacimiento text;

-- Asignación actual de camión a chofer: 1 camión puede tener 1 chofer "actual" (o ninguno).
-- Un chofer puede no tener camión asignado todavía. Para el historial completo se hará una
-- tabla `chofer_camion_historial` separada cuando se implemente la pestaña Historial (punto 4.3).
ALTER TABLE public.camiones
  ADD COLUMN IF NOT EXISTS chofer_actual_id uuid
    REFERENCES public.choferes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS camiones_chofer_actual_id_idx
  ON public.camiones(chofer_actual_id);
