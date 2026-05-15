-- Ampliamos el enum audit_accion para auditar operaciones sobre fotos de camión
alter type public.audit_accion add value if not exists 'foto_agregada';
alter type public.audit_accion add value if not exists 'foto_eliminada';
alter type public.audit_accion add value if not exists 'foto_principal';
alter type public.audit_accion add value if not exists 'nota_foto';
