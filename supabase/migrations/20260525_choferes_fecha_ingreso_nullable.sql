-- Bárbara aún no mandó las fechas de ingreso de los 59 choferes del Excel
-- (PATENTES MODELOS TN.xlsx no trae esa columna). Volvemos fecha_ingreso
-- nullable temporalmente para poder cargar el resto del legajo (nombre,
-- apellido, cuil, dni, telefono, localidad). Cuando lleguen las fechas se
-- completan y se evalúa volver a NOT NULL.
ALTER TABLE public.choferes ALTER COLUMN fecha_ingreso DROP NOT NULL;
