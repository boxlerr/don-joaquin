-- Subir el límite de tamaño del bucket "documentos-personal" de 10 MB a 100 MB.
--
-- Motivo: la carga de documentos del legajo (preocupacional, apercibimientos
-- firmados, etc.) se hacía a través de un Server Action, cuyo body en Vercel
-- está topeado en ~4,5 MB. Archivos más grandes que eso fallaban en el borde
-- de Vercel y la UI quedaba "Subiendo..." para siempre.
--
-- A partir de ahora la subida es directa navegador → Supabase Storage usando
-- una URL firmada (createSignedUploadUrl), por lo que el límite real pasa a ser
-- el del bucket. Lo llevamos a 100 MB.
update storage.buckets
set file_size_limit = 104857600 -- 100 MB
where id = 'documentos-personal';
