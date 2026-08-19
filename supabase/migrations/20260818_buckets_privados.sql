-- Storage: los buckets de fotos y adjuntos pasan a privados.
--
-- Hasta ahora seis buckets estaban marcados `public = true`, que en Supabase
-- significa que el objeto se sirve a cualquiera que tenga la URL, sin sesión.
-- El sistema es interno y esos archivos son remitos, comprobantes, siniestros y
-- fotos de legajo: el acceso tiene que pedir sesión, como el resto del sistema.
--
-- Ahora TODO el código pide el archivo con una URL firmada por el service role
-- (`src/lib/storage-urls.ts`), que es lo que ya hacían compliance, vacaciones,
-- liquidaciones y los adjuntos multi-archivo. La firma vence sola, así que un
-- link que se filtre por WhatsApp deja de servir.
--
-- ⚠️ ORDEN: esta migración va DESPUÉS de que el deploy con las URLs firmadas
-- esté arriba. El código nuevo anda con los buckets públicos o privados (firmar
-- funciona en los dos casos); el viejo, sólo con públicos. Al revés se ven las
-- fotos rotas hasta que termine el deploy.
--
-- Para volver atrás: el mismo update con `true`.
update storage.buckets
set public = false
where id in (
  'avatares-choferes',
  'fotos-camiones',
  'documentos-viajes',
  'documentos-siniestros',
  'documentos-mantenimiento',
  'documentos-roturas'
);
