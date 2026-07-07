-- Evita documentos de compliance de EMPRESA duplicados por (requisito, fecha):
-- el rollover automático (ensureProximosPeriodicos) hace SELECT+INSERT sin atomicidad,
-- y dos corridas concurrentes de generarAlertas podían crear el mismo doc dos veces.
-- El índice único parcial lo previene a nivel DB.
create unique index if not exists compliance_doc_empresa_uniq
  on public.compliance_documentos (requisito_id, fecha_vencimiento)
  where chofer_id is null and camion_id is null;
