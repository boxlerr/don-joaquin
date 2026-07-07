-- Vencimientos del PDF de Jere (06/07/2026) + seguro por unidad (Nación / Segurcoop).
--
-- El pipeline de compliance YA convierte cualquier compliance_documento con
-- fecha_vencimiento en alertas (umbrales 30/15/5/vencido + email en las críticas,
-- vía v_compliance_estado + src/lib/alertas.ts). Así que alcanza con:
--   (1) que exista el requisito, (2) cargar el documento con su fecha real.
-- Esta migración agrega los requisitos que faltaban, carga las fechas y suma la
-- aseguradora por unidad. La periodicidad en días habilita el rollover automático
-- (ver ensureProximosPeriodicos en src/lib/alertas.ts).

-- 1) Periodicidad en días (cada cuánto se renueva un requisito periódico).
alter table public.compliance_requisitos add column if not exists dias_periodicidad integer;

-- 2) Aseguradora del seguro del camión (Nación / Segurcoop / otra).
alter table public.camion_documentos add column if not exists aseguradora text;

-- 3) Requisitos nivel EMPRESA que faltaban.
--    El Seguro de Vida Obligatorio (SVO) es de la EMPRESA (cubre a todo el personal),
--    distinto del "Seguro de vida" por chofer que ya existe.
insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, dias_periodicidad, orden, activo)
select 'EMP_SEGURO_VIDA', 'Seguro de Vida Obligatorio', 'empresa', 'AMBOS', 'anual', 30, 365, 61, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'EMP_SEGURO_VIDA');

--    Certificado de cobertura: se renueva todos los meses (c/30 días).
insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, dias_periodicidad, orden, activo)
select 'EMP_CERT_COBERTURA', 'Certificado de Cobertura', 'empresa', 'AMBOS', 'mensual', 15, 30, 62, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'EMP_CERT_COBERTURA');

-- 4) Periodicidad (en días) de los renovables ya existentes, para el rollover.
update public.compliance_requisitos set dias_periodicidad = 120
  where codigo = 'LIBRE_DEUDA_SINDICAL' and dias_periodicidad is null;
update public.compliance_requisitos set dias_periodicidad = 365
  where codigo in ('ART', 'EMP_POLIZA_SEGURO_FLOTA') and dias_periodicidad is null;

-- 5) Documentos con la fecha de vencimiento real (nivel empresa). Idempotente por
--    (requisito, fecha_vencimiento). Las alertas se generan solas.
do $$
declare
  r record;
  v_reqid uuid;
begin
  for r in
      select 'ART'::text as codigo, date '2026-12-31' as venc,
             'Vence 31/12/2026 (PDF Jere 06/07)'::text as obs
    union all select 'EMP_SEGURO_VIDA', date '2027-06-01',
             'Seguro de Vida Obligatorio — vence 01/06/2027'
    union all select 'EMP_POLIZA_SEGURO_FLOTA', date '2027-03-08',
             'Seguro automotor de flota — vence 08/03/2027 (mayoría Nación)'
    union all select 'EMP_CERT_COBERTURA', current_date + 30,
             'Certificado de cobertura mensual (renueva c/30 días)'
    union all select 'LIBRE_DEUDA_SINDICAL', current_date + 120,
             'Libre deuda sindical (renueva c/120 días)'
  loop
    select id into v_reqid from public.compliance_requisitos where codigo = r.codigo;
    -- Idempotente POR REQUISITO (no por fecha): si ya hay un vencimiento de empresa
    -- para ese requisito no se agrega otro (evita duplicar los de fecha relativa
    -- —certificado c/30, libre deuda c/120— al re-correr en otra fecha).
    if v_reqid is not null and not exists (
      select 1 from public.compliance_documentos
      where requisito_id = v_reqid and chofer_id is null and camion_id is null
    ) then
      insert into public.compliance_documentos (requisito_id, fecha_vencimiento, observaciones)
      values (v_reqid, r.venc, r.obs);
    end if;
  end loop;
end $$;

-- 6) Seguro por unidad: las patentes fuera de Nación van con Segurcoop (dato de Bárbara).
--    AF696CR y AG556LU están en la flota; AF930GJ (tolva de Fernández) es de un tercero,
--    no está en `camiones` → se carga a mano si se da de alta. Sin fecha real todavía:
--    se registra la aseguradora; el vencimiento lo cargan Jere/Bárbara cuando lo tengan.
insert into public.camion_documentos (camion_id, tipo_documento_id, aseguradora, observaciones)
select c.id,
       (select id from public.tipos_documento where codigo = 'seguro_camion'),
       'Segurcoop',
       'Fuera de la póliza Nación (dato de Bárbara 06/07). Cargar el vencimiento cuando esté.'
from public.camiones c
where c.patente in ('AF696CR', 'AG556LU')
  and not exists (
    select 1 from public.camion_documentos cd
    where cd.camion_id = c.id
      and cd.tipo_documento_id = (select id from public.tipos_documento where codigo = 'seguro_camion')
  );
