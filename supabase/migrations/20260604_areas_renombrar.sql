-- Tras separar Viajes (de logística) y Mantenimiento (de flota), los nombres de
-- esas 2 áreas quedaron engañosos. Se renombran para reflejar lo que controlan.
update public.areas set nombre = 'Choferes y Siniestros' where codigo = 'logistica';
update public.areas set nombre = 'Camiones y Extintores'  where codigo = 'flota';
