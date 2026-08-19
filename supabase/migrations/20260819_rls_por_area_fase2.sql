-- RLS por área — Fase 2: logística, viajes, flota, mantenimiento, combustible,
-- comercial, compliance y seguridad.
--
-- Contexto. La Fase 1 (24/06 + 13/07) dejó las policies por área en finanzas,
-- caja y RRHH. Todo el resto de las tablas operativas quedó con las policies
-- genéricas que vienen del principio del proyecto:
--
--     select/insert/update  →  is_authenticated_active()
--     delete                →  is_admin()
--
-- O sea: CUALQUIER usuario activo podía leer, cargar, editar y (salvo borrar)
-- pisar cualquier tabla del sistema pegándole directo a la API REST con su
-- propia sesión, sin pasar por ninguna pantalla. La matriz de áreas existía
-- sólo en la UI. Con 11 usuarios activos —y uno de ellos, Lucas, con rol
-- `operativo` que NO tiene viajes, comercial, mantenimiento ni finanzas— eso ya
-- no es teórico.
--
-- Qué hace esta migración: cablea la matriz real (`rol_areas` + `usuario_areas`)
-- en la base, con los mismos helpers del piloto:
--
--     lectura   →  can_read_area(area)          (rank >= 1)
--     escritura →  can_write_area(area)         (rank >= 2)
--     borrado   →  current_area_rank(area) >= 3 (área-admin)
--
-- El borrado queda igual de cerrado que antes: hoy sólo los admin llegan a
-- rank 3, así que `delete` sigue siendo de admins.
--
-- Por qué algunas tablas leen desde varias áreas. La app cruza módulos: la
-- pantalla de Tarifas (comercial) crea circuitos en `rutas` y `puntos_ruta`
-- (viajes) con el cliente AUTHENTICATED, la ficha del camión muestra services y
-- cargas de gasoil, y el nombre del chofer aparece en media docena de módulos.
-- Cada `or` de la lista de abajo corresponde a un cruce que existe en el código,
-- no a una concesión por las dudas. Las escrituras, en cambio, se gatean por el
-- área dueña salvo dos casos igual de concretos (ver la lista).
--
-- Qué NO toca, a propósito:
--   * Infraestructura de permisos: usuarios, roles, areas, rol_areas,
--     usuario_areas, secciones, rol_secciones, usuario_secciones. Gatearlas
--     rompe getCurrentUser() — es la query que resuelve los permisos.
--   * Catálogos compartidos: bancos, tipos_carga, tipos_documento, tipos_gasto,
--     tipos_servicio, tonelaje_categorias, feriados.
--   * Alertas y notificaciones: son transversales por diseño y ya filtran por
--     usuario en la app.
--   * parametros_sistema, audit_log, login_attempts: ya están con is_admin() o
--     cerradas.
--   * Las tablas que ya viven cerradas (RLS on, cero policies, sólo service
--     role): impuestos, préstamos, métricas, sueldos_admin, F931,
--     clientes_aumentos. Y las de la Fase 1: caja, finanzas, RRHH.
--
-- Los módulos de viajes, choferes, compliance, siniestros, mantenimiento y
-- combustible corren 100% con el service role (admin client), que saltea RLS:
-- para ellos esto no cambia nada en la pantalla, sólo cierra la puerta de la
-- API. Los que sí usan el cliente authenticated son Tarifas y Clientes, y por
-- eso `rutas`/`puntos_ruta` admiten escritura desde comercial.
--
-- Para volver atrás: `20260819_rls_por_area_fase2_rollback.sql` (al lado)
-- devuelve las policies genéricas.

do $$
declare
  r record;
  pol record;
  cond_lectura text;
  cond_escritura text;
  cond_borrado text;
begin
  for r in
    select * from (values
      -- tabla,                       áreas que LEEN,                                 áreas que ESCRIBEN
      -- ── Logística (legajos y personal) ───────────────────────────────────
      -- El roster de choferes lo muestra medio sistema (viajes, ficha de la
      -- unidad, siniestros, DM de YPF, entrevistas): la lectura del nombre es
      -- operativa. Los documentos, ausencias, licencias médicas, préstamos y
      -- vacaciones NO: ésos quedan sólo en logística.
      ('choferes',                    'logistica,viajes,flota,seguridad,rrhh,compliance', 'logistica'),
      ('chofer_documentos',           'logistica,compliance',                         'logistica'),
      ('chofer_documento_archivos',   'logistica,compliance',                         'logistica'),
      ('chofer_apercibimientos',      'logistica',                                    'logistica'),
      ('apercibimiento_archivos',     'logistica',                                    'logistica'),
      ('apercibimiento_categorias',   'logistica',                                    'logistica'),
      ('chofer_ausencias',            'logistica',                                    'logistica'),
      ('chofer_licencias_medicas',    'logistica',                                    'logistica'),
      ('chofer_prestamos',            'logistica',                                    'logistica'),
      ('chofer_vacaciones',           'logistica',                                    'logistica'),
      ('chofer_vacaciones_anios',     'logistica',                                    'logistica'),
      ('rotacion_anual',              'logistica,rrhh',                               'logistica'),
      ('rotacion_bajas',              'logistica,rrhh',                               'logistica'),
      -- ── Viajes ───────────────────────────────────────────────────────────
      ('viajes',                      'viajes',                                       'viajes'),
      ('viaje_archivos',              'viajes',                                       'viajes'),
      ('viaje_tonelaje_detalle',      'viajes',                                       'viajes'),
      ('hojas_ruta',                  'viajes',                                       'viajes'),
      ('hoja_ruta_items',             'viajes',                                       'viajes'),
      -- La planilla diaria cruza chofer↔camión: la carga logística también.
      ('asignacion_diaria',           'viajes,logistica,flota',                       'viajes,logistica'),
      -- Circuitos y puntos: se crean y editan desde /tarifas (comercial) con el
      -- cliente authenticated. Sin comercial en la escritura, esa pantalla
      -- dejaría de guardar.
      ('rutas',                       'viajes,comercial',                             'viajes,comercial'),
      ('puntos_ruta',                 'viajes,comercial',                             'viajes,comercial'),
      ('rutas_cliente_km',            'viajes,comercial',                             'viajes,comercial'),
      -- ── Flota ────────────────────────────────────────────────────────────
      -- La patente se muestra en viajes, mantenimiento y combustible.
      ('camiones',                    'flota,viajes,mantenimiento,combustible,logistica', 'flota'),
      ('acoplados',                   'flota,viajes,mantenimiento',                   'flota'),
      ('camion_acoplados',            'flota,viajes',                                 'flota'),
      ('camion_documentos',           'flota,compliance',                             'flota'),
      ('camion_documento_archivos',   'flota,compliance',                             'flota'),
      ('camion_fotos',                'flota',                                        'flota'),
      ('chofer_camion_historial',     'flota,logistica,viajes',                       'flota,logistica'),
      -- ── Mantenimiento ────────────────────────────────────────────────────
      -- Los services y las gomas se cargan TAMBIÉN desde la ficha del camión
      -- (/camiones → addServiceAction), por eso flota escribe.
      ('mantenimientos',              'mantenimiento,flota',                          'mantenimiento,flota'),
      ('mantenimiento_archivos',      'mantenimiento,flota',                          'mantenimiento,flota'),
      ('roturas_gomas',               'mantenimiento,flota',                          'mantenimiento,flota'),
      ('rotura_archivos',             'mantenimiento,flota',                          'mantenimiento,flota'),
      ('costos_rep_rep',              'mantenimiento',                                'mantenimiento'),
      ('insumos_catalogo',            'mantenimiento,flota',                          'mantenimiento'),
      -- ── Combustible ──────────────────────────────────────────────────────
      -- El gasoil se carga desde /combustible y desde la ficha del camión.
      ('cargas_combustible',          'combustible,flota,viajes',                     'combustible,flota'),
      -- ── Comercial ────────────────────────────────────────────────────────
      -- El cliente se elige al cargar un viaje y se factura/cobra desde caja.
      ('clientes',                    'comercial,viajes,caja,finanzas',               'comercial'),
      ('cliente_contactos',           'comercial',                                    'comercial'),
      ('cliente_sucursales',          'comercial,viajes',                             'comercial'),
      ('cliente_requisitos',          'comercial,compliance',                         'comercial'),
      ('tarifas',                     'comercial,viajes',                             'comercial'),
      -- ── Compliance ───────────────────────────────────────────────────────
      ('compliance_documentos',       'compliance',                                   'compliance'),
      ('compliance_documento_archivos','compliance',                                  'compliance'),
      ('compliance_destinatarios',    'compliance',                                   'compliance'),
      ('compliance_dm_ypf',           'compliance,viajes',                            'compliance'),
      ('compliance_liq_loma',         'compliance,viajes',                            'compliance'),
      -- ── Seguridad ────────────────────────────────────────────────────────
      ('siniestros',                  'seguridad,flota,logistica',                    'seguridad'),
      ('siniestro_archivos',          'seguridad,flota,logistica',                    'seguridad'),
      ('extintores',                  'seguridad,flota',                              'seguridad')
    ) as t(tabla, leen, escriben)
  loop
    -- Armado de las tres condiciones a partir de la lista de áreas.
    select string_agg(format('can_read_area(%L)', trim(x)), ' or ')
      into cond_lectura from unnest(string_to_array(r.leen, ',')) as x;
    select string_agg(format('can_write_area(%L)', trim(x)), ' or ')
      into cond_escritura from unnest(string_to_array(r.escriben, ',')) as x;
    select string_agg(format('current_area_rank(%L) >= 3', trim(x)), ' or ')
      into cond_borrado from unnest(string_to_array(r.escriben, ',')) as x;

    -- Borrón y cuenta nueva: se van TODAS las policies viejas de la tabla
    -- (las genéricas y, si esta migración se corre dos veces, las nuevas).
    for pol in
      select polname from pg_policy where polrelid = format('public.%I', r.tabla)::regclass
    loop
      execute format('drop policy %I on public.%I', pol.polname, r.tabla);
    end loop;

    execute format('create policy %I on public.%I for select using (%s)',
                   r.tabla || '_sel', r.tabla, cond_lectura);
    execute format('create policy %I on public.%I for insert with check (%s)',
                   r.tabla || '_ins', r.tabla, cond_escritura);
    execute format('create policy %I on public.%I for update using (%s) with check (%s)',
                   r.tabla || '_upd', r.tabla, cond_escritura, cond_escritura);
    execute format('create policy %I on public.%I for delete using (%s)',
                   r.tabla || '_del', r.tabla, cond_borrado);
  end loop;
end $$;

-- ── Casos con regla propia ───────────────────────────────────────────────────

-- Requisitos de compliance: el catálogo de qué documento pide cada cliente lo
-- define la dirección. La lectura pasa a compliance; la escritura sigue siendo
-- de admins, como estaba.
drop policy if exists compliance_req_select on public.compliance_requisitos;
create policy compliance_req_select on public.compliance_requisitos
  for select using (can_read_area('compliance'));

-- Pesos del score de choferes: los toca el admin desde /choferes/ranking. La
-- lectura pasa a logística; insert/update siguen en is_admin().
drop policy if exists select_active_user on public.pesos_score_chofer;
create policy pesos_score_sel on public.pesos_score_chofer
  for select using (can_read_area('logistica'));

-- Adjuntos multi-archivo: `documentos_archivos` es la tabla puente de TODOS los
-- módulos (viajes, siniestros, mantenimiento, camiones, impuestos) y la maneja
-- únicamente `src/lib/adjuntos-server.ts`, que es 100% service role —
-- verificado archivo por archivo. Igual que `impuesto_archivos` el 18/08: RLS
-- prendida y sin policies, o sea cerrada para authenticated.
drop policy if exists select_active_user on public.documentos_archivos;
drop policy if exists insert_active_user on public.documentos_archivos;
drop policy if exists update_active_user on public.documentos_archivos;
drop policy if exists delete_admin_only on public.documentos_archivos;
