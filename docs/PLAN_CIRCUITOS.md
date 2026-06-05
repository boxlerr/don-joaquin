# Plan — Circuitos con distancia y km vacíos predefinidos

> Documento de planificación **vivo**. Se va completando a medida que el equipo
> (Nico y demás) aportan requisitos. Última actualización: 2026-06-05.
>
> **ESTADO: implementado** (falta aplicar la migración en la base — ver §3).
> Resumen de lo hecho:
> - Migración `20260605_rutas_km_vacios.sql` (+ tipos en `database.ts`).
> - ABM en tab **Circuitos** de Tarifas (`TabCircuitos.tsx`, `ModalNuevoCircuito.tsx`,
>   acciones `obtenerCircuitos`/`crearCircuito`/`actualizarCircuito`/`cambiarEstadoCircuito`
>   + `validarCircuito`).
> - Selector de circuito con autocompletado (origen/destino/km) y persistencia de
>   `ruta_id` en Nuevo Viaje, EditViajeDialog y Carga Rápida.

## 1. Problema / pedido

Hoy, cada vez que se carga un viaje hay que tipear origen, destino, km cargados
y km vacíos **a mano**, aunque el recorrido sea siempre el mismo.

Nico (reunión): un **circuito** siempre tiene la misma distancia y el mismo
retorno vacío. El sistema debería saberlo solo y autocompletar.

Ejemplos aportados:
- **Pacheco** → siempre retorna vacío (la vuelta entera es km vacíos).
- **Lomasel ↔ Ramallo** → circuito recurrente bidireccional.
- "Voy a LOMASER → después hace ~80 km vacíos" → ese 80 es propiedad del circuito.

## 2. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Modelado | **Reusar la tabla `rutas`** (ya es origen→destino + km_oficiales + codigo_interno, y Tarifas ya la consume). Un "circuito" = una `ruta`. |
| Km vacíos | **Fijo con override**: el circuito trae un `km_vacios` por defecto; al cargar el viaje se puede ajustar si esa vez fue distinto. |

## 3. Modelo de datos

`rutas` hoy: `origen_id`, `destino_id`, `km_oficiales` (km cargados),
`codigo_interno` (ej. "110"), `descripcion`, `estado`.

**Cambio:** agregar columna `km_vacios int NOT NULL DEFAULT 0` a `rutas`.

- `km_oficiales` = km **cargados** del circuito (ida con carga).
- `km_vacios`    = km **vacíos** predefinidos (retorno vacío típico).

> Migración nueva: `supabase/migrations/AAAAMMDD_rutas_km_vacios.sql`.
> Regenerar `src/types/database.ts` (la tabla `rutas` Row/Insert/Update).

### Pendiente de definir (preguntas abiertas)
- [ ] **Direccionalidad**: ¿el circuito representa la vuelta redonda (ida cargada
  + vuelta vacía) o solo un tramo? El caso "Pacheco retorna vacío" sugiere
  vuelta redonda. "Lomasel ↔ Ramallo" sugiere que a veces va cargado en ambos
  sentidos. → confirmar si hace falta un campo `sentido`/`bidireccional` o si
  alcanza con cargar dos rutas (A→B y B→A).
- [ ] ¿El circuito debe quedar **vinculado a un cliente** o es genérico? Hoy
  `rutas` no tiene cliente (el override por cliente vive en `rutas_cliente_km`).
- [ ] ¿Hace falta guardar también el **monto de flete** sugerido por circuito, o
  eso ya lo resuelve Tarifas (cliente + ruta)?

## 4. ABM de Circuitos (nuevo)

Hoy **no existe** pantalla para crear/editar rutas (se cargaron por seed). Hay
que construirla.

- Ubicación propuesta: `/configuracion` (tab "Circuitos") o sección propia
  `/circuitos`. → a confirmar dónde encaja mejor en el sidebar.
- Listado: código, origen → destino, km cargados, km vacíos, estado.
- Alta/edición: origen (combo `puntos_ruta` + alta rápida), destino, km cargados,
  km vacíos, código interno, descripción, estado.
- Permisos: área `comercial` (write) — misma que Tarifas. _A confirmar._

## 5. Integración en "Nuevo Viaje"

Form actual (`new-viaje-sheet.tsx`): origen/destino como texto libre + km a mano.

**Cambio:** agregar un selector **"Circuito"** arriba de origen/destino.

- Al elegir un circuito:
  - autocompleta `origen_nombre`, `destino_nombre`,
  - `km_con_carga` = `km_oficiales`,
  - `km_vacios`    = `km_vacios` del circuito,
  - guarda `ruta_id` en el viaje (hoy **no se guarda**; el viaje ya tiene la
    columna `ruta_id` disponible).
- Los campos quedan **editables** (override puntual).
- Mantener la carga manual libre para viajes sin circuito (no romper el flujo
  actual).

Server action `createViajeAction`: aceptar `ruta_id` opcional y persistirlo.
Misma lógica replicar en `EditViajeDialog` y en carga rápida (`CargaRapidaGrid`).

## 6. Alcance / archivos afectados (estimado)

- `supabase/migrations/*_rutas_km_vacios.sql` (nuevo)
- `src/types/database.ts` (regenerar tipos rutas)
- ABM circuitos: nueva carpeta `src/app/(dashboard)/circuitos/` (o tab en config)
  - `page.tsx`, `actions.ts`, componentes de tabla + modal alta/edición
- `src/components/layout/nav-items.ts` (entrada de sidebar, si es página propia)
- `src/app/(dashboard)/viajes/components/new-viaje-sheet.tsx` (selector circuito)
- `src/app/(dashboard)/viajes/actions.ts` (`ViajeFormData` con circuitos;
  `createViajeAction` persiste `ruta_id`)
- `EditViajeDialog.tsx` y `carga-rapida/CargaRapidaGrid.tsx` (mismo autocompletado)

## 7. Fuera de alcance (por ahora)
- Cálculo automático de tarifa al elegir circuito (ya existe
  `buscarTarifaAplicable`; se puede enganchar en una fase 2).
- Reportes de km vacíos por chofer/circuito.

## 8. Notas para no romper nada
- `rutas` ya alimenta Tarifas (`obtenerClientesYRutas`, `buscarTarifaAplicable`).
  Agregar `km_vacios` con default no afecta esos flujos.
- El viaje seguirá guardando `origen_id`/`destino_id` además de `ruta_id`
  (snapshot), así no se pierde info si luego se edita/baja el circuito.
