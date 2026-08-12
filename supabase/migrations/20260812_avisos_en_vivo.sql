-- Avisos en vivo: que la pantalla se entere de que alguien cargó algo, sin F5.
--
-- El problema: si dos personas están en la caja y una carga un movimiento, la
-- otra no se entera hasta que recarga. Hoy la caja lo resuelve preguntando cada
-- 15 segundos, que es caro —dos llamadas al servidor por pestaña abierta, todo
-- el día, haya o no novedades— y llega tarde igual.
--
-- La forma barata es al revés: que el sistema avise. El navegador mantiene un
-- WebSocket abierto contra Supabase —que no pasa por Vercel y por lo tanto no
-- cuesta invocaciones— y recibe un mensaje cuando algo cambió.
--
-- LA REGLA QUE NO SE NEGOCIA: el aviso NO lleva datos de la fila.
--
-- El navegador se conecta con la anon key y lo único que lo frena es RLS. La
-- caja tiene movimientos que dirección marca como ocultos y columnas
-- confidenciales, y ese filtro hoy corre en el servidor con la service key. Si
-- el aviso trajera la fila, cualquiera con sesión se saltearía ese filtro. Por
-- eso el mensaje dice solamente "cambió tal sección": el navegador se entera de
-- que hay novedades y vuelve a pedir los datos por donde los pide siempre, que
-- es donde los permisos se aplican de verdad.
--
-- Por lo mismo no se publica ninguna tabla en `supabase_realtime`: escuchar la
-- tabla directo es exactamente lo que queremos evitar.
--
-- ───────────────────────────────────────────────────────────────────────────
-- POR QUÉ ESTO NO ES UN TRIGGER
-- ───────────────────────────────────────────────────────────────────────────
--
-- El camino "de manual" para esto es un trigger que llame a `realtime.send()`.
-- Se probó contra una tabla de descarte y NO FUNCIONA en este proyecto, en
-- silencio y sin errores:
--
--   · `realtime.messages` está particionada por fecha y no tiene NINGUNA
--     partición creada.
--   · `pg_cron` no está instalado, que es lo que en Supabase crea la partición
--     de cada día.
--   · `realtime.send()` atrapa su propio error y lo baja a WARNING (se puede
--     ver en su definición). O sea: el INSERT entra, la función "no falla" y el
--     aviso no sale nunca.
--
-- Un trigger habría quedado ahí, verde y mudo. Los avisos se mandan desde el
-- servidor con la API HTTP de broadcast (`lib/avisos.ts`), que no toca
-- `realtime.messages` ni depende de particiones ni de cron. Además evita poner
-- un trigger en el camino caliente de `viajes` y `movimientos_caja`.
--
-- Lo único que hace falta en la base es esta policy, para que el navegador
-- pueda escuchar.

-- ───────────────────────────────────────────────────────────────────────────
-- Quién puede escuchar
-- ───────────────────────────────────────────────────────────────────────────

-- Sin esta policy nadie recibe nada: los canales privados de Realtime niegan
-- por defecto. Se pide usuario autenticado Y activo —la misma función que usan
-- las tablas del sistema— así alguien dado de baja deja de recibir avisos
-- aunque le quede una pestaña abierta.
--
-- Sigue sin haber datos que filtrar acá: lo único que viaja es el nombre de la
-- sección. Los permisos por área se aplican después, cuando la pantalla vuelve
-- a pedirle los datos al servidor.
drop policy if exists "escuchar avisos de cambios" on realtime.messages;

create policy "escuchar avisos de cambios"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'cambios:%'
    and public.is_authenticated_active()
  );
