-- La columna archivo_id vieja (deprecada, reemplazada por las tablas puente
-- <entidad>_archivos) no debe bloquear el borrado de un archivo desde la tabla
-- puente: pasamos su FK a ON DELETE SET NULL. (apercibimientos y compliance ya
-- eran SET NULL; acá arreglamos chofer_documentos y camion_documentos que eran
-- NO ACTION y bloqueaban el delete de un adjunto backfilleado.)
alter table public.chofer_documentos drop constraint if exists chofer_documentos_archivo_id_fkey;
alter table public.chofer_documentos add constraint chofer_documentos_archivo_id_fkey
  foreign key (archivo_id) references public.documentos_archivos(id) on delete set null;

alter table public.camion_documentos drop constraint if exists camion_documentos_archivo_id_fkey;
alter table public.camion_documentos add constraint camion_documentos_archivo_id_fkey
  foreign key (archivo_id) references public.documentos_archivos(id) on delete set null;
