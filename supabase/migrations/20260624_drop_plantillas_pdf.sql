-- Sección Plantillas PDF eliminada por completo. Aplicada vía MCP.
-- Motivo: CRUD real pero ningún generador la consumía (la impresión usa rutas (print) con HTML
-- del browser); el editor visual estaba "próximamente" y "descargar" generaba un .txt inútil.
-- Se eliminó la ruta /configuracion/plantillas-pdf, el item del nav/sidebar y las menciones del
-- tutorial. La tabla no tiene FKs que la referencien.
drop table if exists public.plantillas_pdf;
