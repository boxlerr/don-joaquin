-- Compliance — unificación §9 (reunión Nico 29/06)
-- Creado: 30/06/2026
--
-- Seed idempotente (NO crea tablas: el esquema de compliance ya existe en remoto).
-- Agrega documentación que faltaba para cubrir el rol de Noelia:
--   1) Docs de choferes: "Libre de deuda sindical" y "Seguro de vida" (van para todos
--      los choferes). Se modelan como tipos_documento (viven en el legajo) + un
--      compliance_requisito de nivel chofer que la vista v_compliance_estado expande
--      por chofer y las alertas existentes toman solas.
--   2) Póliza de seguro de flota: requisito único a nivel empresa (la póliza es única
--      en la flota). Las unidades fuera de la póliza se cargan con su vencimiento
--      puntual en su requisito de seguro por unidad.
--
-- Idempotente con `where not exists (... codigo = ...)` para poder re-aplicar sin duplicar.
-- Las piezas de "editar/registrar vencimiento sin archivo" y "observaciones visibles"
-- no necesitan DDL (archivo_id ya es nullable en las 3 tablas; observaciones ya existe).

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Tipos de documento de choferes (legajo)
-- ────────────────────────────────────────────────────────────────────────────

insert into public.tipos_documento (codigo, nombre, aplica_a, obligatorio, dias_alerta_vencimiento)
select 'libre_deuda_sindical', 'Libre de deuda sindical', 'chofer', false, 30
where not exists (select 1 from public.tipos_documento where codigo = 'libre_deuda_sindical');

insert into public.tipos_documento (codigo, nombre, aplica_a, obligatorio, dias_alerta_vencimiento)
select 'seguro_vida', 'Seguro de vida', 'chofer', false, 30
where not exists (select 1 from public.tipos_documento where codigo = 'seguro_vida');

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Requisitos de compliance — choferes (van para todos, vencimiento anual)
-- ────────────────────────────────────────────────────────────────────────────

insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, tipo_documento_id, orden, activo)
select 'CH_LIBRE_DEUDA_SINDICAL', 'Libre de deuda sindical', 'chofer', 'AMBOS', 'anual', 30,
       (select id from public.tipos_documento where codigo = 'libre_deuda_sindical'), 50, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'CH_LIBRE_DEUDA_SINDICAL');

insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, tipo_documento_id, orden, activo)
select 'CH_SEGURO_VIDA', 'Seguro de vida', 'chofer', 'AMBOS', 'anual', 30,
       (select id from public.tipos_documento where codigo = 'seguro_vida'), 51, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'CH_SEGURO_VIDA');

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Póliza de seguro de flota — requisito único a nivel empresa
-- ────────────────────────────────────────────────────────────────────────────

insert into public.compliance_requisitos
  (codigo, nombre, nivel, cliente_aplica, periodicidad, dias_alerta, orden, activo)
select 'EMP_POLIZA_SEGURO_FLOTA', 'Póliza de seguro (flota)', 'empresa', 'AMBOS', 'anual', 30, 60, true
where not exists (select 1 from public.compliance_requisitos where codigo = 'EMP_POLIZA_SEGURO_FLOTA');
