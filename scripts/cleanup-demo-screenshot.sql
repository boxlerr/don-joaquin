-- Cleanup de seeds [DEMO-SCREENSHOT-20260530] insertados el 30/05/2026
-- para poblar los screenshots del Resumen semanal 20–29 may 2026.
--
-- Se borra TODO lo marcado con observaciones LIKE '[DEMO-SCREENSHOT-20260530]%'
-- Orden: dependencias primero (cargas/mantenimientos/etc) y viajes al final.
--
-- Choferes afectados:
--   Cosentino Luciano Juan, Acosta Pablo Maximo, Benítez Sergio Agustín,
--   Arias Cesar Ricardo, Fernandez José Luis
--
-- Conteos esperados al ejecutar (al 30/05): 6 prestamos, 1 licencia, 6 aperc,
-- 8 roturas, 7 mantenimientos, 20 cargas, 83 viajes.

BEGIN;

DELETE FROM chofer_prestamos        WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM chofer_licencias_medicas WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM chofer_apercibimientos  WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM roturas_gomas           WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM mantenimientos          WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM cargas_combustible      WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';
DELETE FROM viajes                  WHERE observaciones LIKE '[DEMO-SCREENSHOT-20260530]%';

COMMIT;
