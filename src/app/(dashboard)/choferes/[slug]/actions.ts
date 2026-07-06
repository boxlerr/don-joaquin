"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, requireSeccion, requireAdmin, hasArea, hasSeccion } from "@/lib/auth";
import { getOcultasPorUsuario } from "@/lib/alertas-lecturas";
import { revalidatePath } from "next/cache";
import { calcularEficienciaPorDeltas } from "@/lib/combustible-eficiencia";
import { choferSlug, isUuid } from "@/lib/chofer-slug";
import { computeScoreChofer } from "../ranking/lib";
import { logChoferAudit } from "../audit";
import {
  crearUrlSubidaAdjunto,
  vincularAdjuntos,
  getAdjuntos,
  deleteAdjunto,
  type AdjuntoCfg,
  type AdjuntoExistente,
  type ArchivoMeta as AdjuntoArchivoMeta,
  type CrearUrlResult,
} from "@/lib/adjuntos-server";
import type {
  ChoferDetail,
  PrestamoEstado,
  ProductividadKPIs,
  CamionHistorialItem,
  AdelantoMes,
  EvolucionMes,
  PesosScore,
  Ausencia,
  AusenciaEstado,
  ViajeEnRango,
} from "./types";

export async function getChoferDetailAction(slugOrId: string): Promise<ChoferDetail | null> {
  const user = await requireSeccion("choferes", "read");
  // Los datos de sueldo (liquidación, adelantos) son confidenciales: solo si tiene la subsección.
  const canVerSueldos = hasSeccion(user, "sueldos", "read");
  const supabase = createAdminClient();

  const baseSelect =
    "id, nombre, apellido, dni, cuil, estado, localidad, email, telefono, domicilio, provincia, fecha_nacimiento, fecha_ingreso, fecha_egreso, motivo_egreso, observaciones, cbu, alias_cbu, banco, telefono_emergencia, ciudad_nacimiento, nro_tramite_dni, clave_fiscal, alta_afip, periodo_prueba_fin, rol, updated_at, foto_id, foto:documentos_archivos(bucket, path)";

  type ChoferRow = { id: string; apellido: string; nombre: string } & Record<string, unknown>;
  let chofer: ChoferRow | null = null;

  if (isUuid(slugOrId)) {
    const { data } = await supabase.from("choferes").select(baseSelect).eq("id", slugOrId).single();
    chofer = (data as ChoferRow) ?? null;
  } else {
    const { data: candidates } = await supabase.from("choferes").select(baseSelect);
    chofer =
      (candidates as ChoferRow[] | null)?.find((c) => c && choferSlug(c) === slugOrId) ?? null;
  }

  if (!chofer) return null;
  const chofer_id = chofer.id;

  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  const seisMesesAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
    .toISOString()
    .split("T")[0];

  const [
    { data: docs },
    { data: viajes },
    { data: movimientos },
    { data: tiposDoc },
    { data: apercibimientos },
    { data: licencias },
    { data: prestamos },
    { data: categoriasApe },
    { data: viajesMes },
    { data: viaticosMes },
    { data: camionesHist },
    { data: roturasMes },
    { data: viajes6meses },
    { data: cargasCombustibleMes },
    { data: pesosRow },
    { data: rankingViajes },
    { data: rankingApercs },
    { data: rankingRoturas },
    { data: rankingLicencias },
  ] = await Promise.all([
    supabase
      .from("v_chofer_documentos_vigencia")
      .select("id, tipo_documento, tipo_documento_codigo, fecha_vencimiento, dias_restantes, estado_vigencia, numero")
      .eq("chofer_id", chofer_id),

    supabase
      .from("viajes")
      .select("id, codigo, fecha_viaje, km_con_carga, km_vacios, estado, facturado")
      .eq("chofer_id", chofer_id)
      .neq("estado", "cancelado") // los borrados (soft delete) no van al legajo
      .order("fecha_viaje", { ascending: false })
      .limit(20),

    supabase
      .from("caja_movimientos")
      .select("id, fecha, concepto, tipo, monto, categoria")
      .eq("chofer_id", chofer_id)
      .gte("fecha", primerDia)
      .order("fecha", { ascending: false }),

    supabase
      .from("tipos_documento")
      .select("id, nombre, codigo")
      .eq("aplica_a", "chofer")
      .eq("estado", "activo"),

    // `tipo` es columna nueva (no está en database.ts) → cliente laxo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_apercibimientos")
      .select("id, fecha, tipo, categoria_id, motivo, observaciones, created_at, categoria:apercibimiento_categorias(nombre), archivo:documentos_archivos(bucket, path, nombre_original)")
      .eq("chofer_id", chofer_id)
      .order("fecha", { ascending: false }),

    supabase
      .from("chofer_licencias_medicas")
      .select("id, fecha_desde, fecha_hasta, motivo, observaciones, created_at")
      .eq("chofer_id", chofer_id)
      .order("fecha_desde", { ascending: false }),

    supabase
      .from("chofer_prestamos")
      .select("id, fecha, monto, moneda, cuotas, saldo_pendiente, estado, motivo, observaciones, created_at")
      .eq("chofer_id", chofer_id)
      .order("fecha", { ascending: false }),

    supabase
      .from("apercibimiento_categorias")
      .select("id, codigo, nombre, descripcion")
      .eq("estado", "activo")
      .order("orden"),

    supabase
      .from("viajes")
      .select("id, km_con_carga, km_vacios, tonelaje_real, monto_flete, moneda, camiones(capacidad_tn)")
      .eq("chofer_id", chofer_id)
      .gte("fecha_viaje", primerDia)
      .lte("fecha_viaje", ultimoDia),

    supabase
      .from("viaticos")
      .select("id, fecha_entrega, monto_adelanto, moneda, viaje:viajes(codigo)")
      .eq("chofer_id", chofer_id)
      .gt("monto_adelanto", 0)
      .gte("fecha_entrega", primerDia)
      .lte("fecha_entrega", ultimoDia)
      .order("fecha_entrega", { ascending: false }),

    supabase
      .from("chofer_camion_historial")
      .select("id, camion_id, desde, hasta, motivo_cambio, camion:camiones(patente, marca, modelo)")
      .eq("chofer_id", chofer_id)
      .order("desde", { ascending: false }),

    // Roturas vinculadas directamente a este chofer.
    // Roturas registradas solo contra camion/acoplado sin chofer_id no se cuentan aquí.
    supabase
      .from("roturas_gomas")
      .select("id, cantidad, costo, moneda, fecha")
      .eq("chofer_id", chofer_id)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),

    supabase
      .from("viajes")
      .select("fecha_viaje, km_con_carga, km_vacios, tonelaje_real, monto_flete, moneda")
      .eq("chofer_id", chofer_id)
      .gte("fecha_viaje", seisMesesAtras)
      .order("fecha_viaje", { ascending: true })
      .limit(300),

    // Cargas de gasoil del chofer en el mes (para eficiencia L/100km).
    // Solo cuenta cargas con chofer_id seteado; necesita ≥2 cargas del mismo
    // camión para tener delta de odómetro. Mismo criterio que el ranking de /combustible.
    supabase
      .from("cargas_combustible")
      .select("camion_id, km_odometro, litros")
      .eq("chofer_id", chofer_id)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),

    // Configuración de pesos del score (singleton)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("pesos_score_chofer")
      .select("id, peso_vacios_bajo, peso_vacios_medio, peso_vacios_alto, umbral_vacios_bajo, umbral_vacios_medio, umbral_vacios_alto, peso_apercibimiento, peso_rotura, peso_licencia")
      .limit(1)
      .maybeSingle(),

    // Ranking: viajes de todos los choferes activos este mes (para calcular posición)
    supabase
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios")
      .gte("fecha_viaje", primerDia)
      .lte("fecha_viaje", ultimoDia)
      .not("chofer_id", "is", null),

    // Apercibimientos del mes de todos los choferes (para el score legacy del legajo).
    // Solo los que pesan en "apercibimientos" (apercibimiento/multa); los eventos de
    // conducta (llamado/adelanto) no inflan este conteo. `as any`: `tipo` es nueva.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_apercibimientos")
      .select("chofer_id")
      .in("tipo", ["apercibimiento", "multa"])
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),

    // Roturas del mes de todos los choferes (para score ranking)
    supabase
      .from("roturas_gomas")
      .select("chofer_id")
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia)
      .not("chofer_id", "is", null),

    // Licencias médicas activas de todos los choferes (para score ranking)
    supabase
      .from("chofer_licencias_medicas")
      .select("chofer_id")
      .is("fecha_hasta", null),
  ]);

  // Camión actualmente asignado al chofer (puede ser ninguno) + asignaciones
  // diarias del mes (reemplazos puntuales chofer↔camión por día).
  const [{ data: camionActual }, { data: asignacionesDiariasMes }] = await Promise.all([
    supabase
      .from("camiones")
      .select("id, patente, marca, modelo, ano")
      .eq("chofer_actual_id", chofer_id)
      // limit(1) evita que maybeSingle tire error (y devuelva null) si por una
      // inconsistencia el chofer quedara con más de un camión: mostramos uno igual.
      .order("patente", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("camion_id")
      .eq("chofer_id", chofer_id)
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),
  ]);

  // Ausencias / permisos programados. Cast porque el select embebe `usuarios!autorizado_por`,
  // que el cliente tipado no infiere bien con el alias.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ausenciasRaw } = (await (supabase as any)
    .from("chofer_ausencias")
    .select("id, tipo, fecha_inicio, fecha_fin, estado, observaciones, es_vacaciones, justificada, created_at, autorizado:usuarios!autorizado_por(nombre, apellido)")
    .eq("chofer_id", chofer_id)
    .is("deleted_at", null)
    .order("fecha_inicio", { ascending: false })) as {
    data:
      | {
          id: string;
          tipo: string;
          fecha_inicio: string;
          fecha_fin: string;
          estado: string;
          observaciones: string | null;
          es_vacaciones: boolean | null;
          justificada: boolean | null;
          created_at: string;
          autorizado: { nombre: string; apellido: string | null } | { nombre: string; apellido: string | null }[] | null;
        }[]
      | null;
  };

  // Saldo de vacaciones del chofer (lo que carga RRHH). Tabla nueva → cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vacacionesSaldoRaw } = (await (supabase as any)
    .from("chofer_vacaciones")
    .select("dias_correspondientes, dias_adeudados")
    .eq("chofer_id", chofer_id)
    .maybeSingle()) as {
    data: { dias_correspondientes: number; dias_adeudados: number } | null;
  };

  // Camiones que el chofer manejó en el mes: historial que solapa el período + el actual.
  const camionIdsDelMes = new Set<string>();
  for (const h of camionesHist ?? []) {
    const solapa = h.desde <= ultimoDia && (!h.hasta || h.hasta >= primerDia);
    if (solapa && h.camion_id) camionIdsDelMes.add(h.camion_id);
  }
  if (camionActual?.id) camionIdsDelMes.add(camionActual.id);
  // Camiones manejados por asignación diaria (reemplazos puntuales) en el mes.
  for (const a of (asignacionesDiariasMes ?? []) as { camion_id: string | null }[]) {
    if (a.camion_id) camionIdsDelMes.add(a.camion_id);
  }

  const viajeIdsDelMes = (viajesMes ?? []).map((v) => v.id).filter(Boolean) as string[];

  // Queries que dependen de los ids resueltos arriba:
  //   - mantenimientos de esos camiones en el mes (para "veces al taller")
  //   - items de hoja de ruta de esos viajes (para "liquidación al chofer")
  //   - roturas de gomas del chofer (lista detallada, últimas 20, cualquier período)
  const [{ data: mantenimientosMes }, { data: itemsLiquidacion }, { data: roturasDetalle }] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select("id, tipo, tipo_servicio:tipos_servicio(codigo)")
      .in("camion_id", [...camionIdsDelMes])
      .gte("fecha", primerDia)
      .lte("fecha", ultimoDia),
    supabase
      .from("hoja_ruta_items")
      .select("monto_chofer")
      .in("viaje_id", viajeIdsDelMes),
    supabase
      .from("roturas_gomas")
      .select("id, fecha, cantidad, costo, moneda, posicion, observaciones, camion:camiones(patente), acoplado:acoplados(patente)")
      .eq("chofer_id", chofer_id)
      .order("fecha", { ascending: false })
      .limit(20),
  ]);

  const fotoObj = chofer.foto ? (Array.isArray(chofer.foto) ? chofer.foto[0] : chofer.foto) : null;

  const docIds = (docs ?? []).map((d) => d.id).filter(Boolean) as string[];
  let alertsQuery = supabase
    .from("alertas")
    .select("id, tipo, severidad, titulo, mensaje, entidad_id, entidad_tipo")
    .eq("estado", "pendiente");

  if (docIds.length > 0) {
    alertsQuery = alertsQuery.or(
      `entidad_id.eq.${chofer_id},and(entidad_tipo.eq.chofer_documentos,entidad_id.in.(${docIds.map(id => `"${id}"`).join(",")}))`
    );
  } else {
    alertsQuery = alertsQuery.eq("entidad_id", chofer_id);
  }

  const { data: activeAlerts } = await alertsQuery;

  // Estado leído/descartado per-user: ocultamos del legajo las alertas (de cumpleaños,
  // prueba, ausencia, etc.) que ESTE usuario ya marcó leídas. Las de documentos
  // (vencimiento_doc_*) no son marcables, así que nunca quedan en este set.
  const ocultasUsuario = await getOcultasPorUsuario(user.id);
  const activeAlertsVisibles = (activeAlerts ?? []).filter((a) => !ocultasUsuario.has(a.id));

  // Consultar archivos y campos adicionales asociados a los documentos
  const { data: dbDocsWithFields } = docIds.length > 0
    ? await supabase
        .from("chofer_documentos")
        .select("id, tipo_documento_id, fecha_emision, archivo:documentos_archivos(bucket, path, nombre_original)")
        .in("id", docIds)
    : { data: [] };

  const docsExtraMap = new Map<string, { tipo_documento_id: string; fecha_emision: string | null; url: string | null; nombre_original: string | null }>();
  const bucketFiles = new Map<string, { id: string; path: string; nombre_original: string }[]>();

  for (const item of dbDocsWithFields || []) {
    const arch = Array.isArray(item.archivo) ? item.archivo[0] : item.archivo;
    if (arch) {
      if (!bucketFiles.has(arch.bucket)) {
        bucketFiles.set(arch.bucket, []);
      }
      bucketFiles.get(arch.bucket)!.push({
        id: item.id,
        path: arch.path,
        nombre_original: arch.nombre_original,
      });
    }
    docsExtraMap.set(item.id, {
      tipo_documento_id: item.tipo_documento_id,
      fecha_emision: item.fecha_emision,
      url: null,
      nombre_original: arch?.nombre_original ?? null,
    });
  }

  // Solicitar URLs firmadas en lote por bucket
  for (const [bucket, files] of bucketFiles.entries()) {
    const paths = files.map((f) => f.path);
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 3600); // Expiración de 1 hora

    if (!signError && signedData) {
      for (const signedItem of signedData) {
        const fileObj = files.find((f) => f.path === signedItem.path);
        if (fileObj) {
          const prevEntry = docsExtraMap.get(fileObj.id);
          if (prevEntry) {
            docsExtraMap.set(fileObj.id, {
              ...prevEntry,
              url: signedItem.signedUrl ?? null,
            });
          }
        }
      }
    }
  }

  const mappedDocs = (docs ?? []).map((d) => {
    const extra = d.id ? docsExtraMap.get(d.id) : null;
    return {
      ...d,
      tipo_documento_id: extra?.tipo_documento_id ?? null,
      fecha_emision: extra?.fecha_emision ?? null,
      archivo_url: extra?.url ?? null,
      archivo_nombre: extra?.nombre_original ?? null,
    };
  });

  // `apercibimientos` viene de un cliente casteado a any (columna `tipo` nueva).
  type ArchivoEmbed = { bucket: string; path: string; nombre_original: string };
  type ApeRowRaw = {
    id: string;
    fecha: string;
    tipo: string | null;
    categoria_id: string | null;
    motivo: string;
    observaciones: string | null;
    created_at: string;
    categoria: { nombre?: string } | { nombre?: string }[] | null;
    archivo: ArchivoEmbed | ArchivoEmbed[] | null;
  };
  const apercibimientosRows = (apercibimientos ?? []) as ApeRowRaw[];

  // URLs firmadas de los archivos adjuntos a apercibimientos (ej: escaneo firmado).
  const apercArchivoMap = new Map<string, { url: string | null; nombre: string | null }>();
  {
    const conArchivo = apercibimientosRows
      .map((a) => {
        const arch = Array.isArray(a.archivo) ? a.archivo[0] : a.archivo;
        return arch ? { id: a.id, bucket: arch.bucket, path: arch.path, nombre: arch.nombre_original } : null;
      })
      .filter((x): x is { id: string; bucket: string; path: string; nombre: string } => x !== null);
    const porBucket = new Map<string, { id: string; path: string; nombre: string }[]>();
    for (const f of conArchivo) {
      if (!porBucket.has(f.bucket)) porBucket.set(f.bucket, []);
      porBucket.get(f.bucket)!.push({ id: f.id, path: f.path, nombre: f.nombre });
    }
    for (const [bucket, files] of porBucket.entries()) {
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrls(files.map((f) => f.path), 3600);
      for (const s of signed ?? []) {
        const f = files.find((x) => x.path === s.path);
        if (f) apercArchivoMap.set(f.id, { url: s.signedUrl ?? null, nombre: f.nombre });
      }
    }
  }

  const viajesMesArr = viajesMes ?? [];
  const km_con_carga = viajesMesArr.reduce((acc, v) => acc + Number(v.km_con_carga ?? 0), 0);
  const km_vacios = viajesMesArr.reduce((acc, v) => acc + Number(v.km_vacios ?? 0), 0);
  const km_total = km_con_carga + km_vacios;
  const toneladas = viajesMesArr.reduce((acc, v) => acc + Number(v.tonelaje_real ?? 0), 0);
  // Utilización: Σ tonelaje / Σ capacidad del camión, solo sobre viajes con carga
  // (tn > 0) y con capacidad del camión conocida. Mismo criterio que el resumen
  // mensual: compara peras con peras y respeta la capacidad real (29/35/37,5).
  const utilizacionAcum = viajesMesArr.reduce(
    (acc, v) => {
      const tn = Number(v.tonelaje_real ?? 0);
      // camiones llega como objeto o null según el join de Supabase.
      const cam = Array.isArray(v.camiones) ? v.camiones[0] : v.camiones;
      const cap = Number(cam?.capacidad_tn) || 0;
      if (tn > 0 && cap > 0) {
        acc.tonelaje += tn;
        acc.capacidad += cap;
      }
      return acc;
    },
    { tonelaje: 0, capacidad: 0 },
  );
  const utilizacion_pct =
    utilizacionAcum.capacidad > 0
      ? (utilizacionAcum.tonelaje / utilizacionAcum.capacidad) * 100
      : null;
  const facturacion_ars = viajesMesArr
    .filter((v) => v.moneda === "ARS")
    .reduce((acc, v) => acc + Number(v.monto_flete ?? 0), 0);
  const facturacion_usd = viajesMesArr
    .filter((v) => v.moneda === "USD")
    .reduce((acc, v) => acc + Number(v.monto_flete ?? 0), 0);

  const viaticosArr = viaticosMes ?? [];
  const adelantos_viaticos_ars = viaticosArr
    .filter((v) => v.moneda === "ARS")
    .reduce((acc, v) => acc + Number(v.monto_adelanto ?? 0), 0);
  const adelantos_viaticos_usd = viaticosArr
    .filter((v) => v.moneda === "USD")
    .reduce((acc, v) => acc + Number(v.monto_adelanto ?? 0), 0);

  // Roturas del mes
  const roturasMesArr = roturasMes ?? [];
  const roturas_mes = roturasMesArr.length;
  const roturas_cantidad_mes = roturasMesArr.reduce((acc, r) => acc + (r.cantidad ?? 1), 0);

  // Apercibimientos del mes (filtrar del array ya traído). Para el score/KPI legacy
  // no contamos los eventos de conducta (llamado/adelanto), solo apercibimiento/multa.
  const apercibimientosMesArr = apercibimientosRows.filter(
    (a) =>
      a.fecha >= primerDia &&
      a.fecha <= ultimoDia &&
      a.tipo !== "llamado_atencion" &&
      a.tipo !== "adelanto",
  );
  const apercibimientos_mes = apercibimientosMesArr.length;

  // Licencias médicas
  const licenciasArr = licencias ?? [];
  const licenciasMes = licenciasArr.filter(
    (l) => l.fecha_desde <= ultimoDia && (!l.fecha_hasta || l.fecha_hasta >= primerDia),
  );
  const licencias_activas = licenciasArr.filter((l) => !l.fecha_hasta).length;
  let licencias_dias_mes = 0;
  const primerDiaMs = new Date(primerDia + "T00:00:00").getTime();
  const ultimoDiaMs = new Date(ultimoDia + "T00:00:00").getTime();
  for (const l of licenciasMes) {
    const desdeMs = Math.max(new Date(l.fecha_desde + "T00:00:00").getTime(), primerDiaMs);
    const hastaMs = l.fecha_hasta
      ? Math.min(new Date(l.fecha_hasta + "T00:00:00").getTime(), ultimoDiaMs)
      : ultimoDiaMs;
    if (hastaMs >= desdeMs) {
      licencias_dias_mes += Math.round((hastaMs - desdeMs) / 86_400_000) + 1;
    }
  }

  // Préstamos activos (pendiente o parcial)
  const prestamos_activos = (prestamos ?? []).filter(
    (p) => p.estado === "pendiente" || p.estado === "parcial",
  ).length;

  // Pesos configurados (con fallback a defaults si la tabla está vacía)
  const pesos: PesosScore = pesosRow
    ? {
        id: pesosRow.id,
        peso_vacios_bajo: Number(pesosRow.peso_vacios_bajo),
        peso_vacios_medio: Number(pesosRow.peso_vacios_medio),
        peso_vacios_alto: Number(pesosRow.peso_vacios_alto),
        umbral_vacios_bajo: Number(pesosRow.umbral_vacios_bajo),
        umbral_vacios_medio: Number(pesosRow.umbral_vacios_medio),
        umbral_vacios_alto: Number(pesosRow.umbral_vacios_alto),
        peso_apercibimiento: Number(pesosRow.peso_apercibimiento),
        peso_rotura: Number(pesosRow.peso_rotura),
        peso_licencia: Number(pesosRow.peso_licencia),
      }
    : {
        id: "",
        peso_vacios_bajo: 8,
        peso_vacios_medio: 15,
        peso_vacios_alto: 20,
        umbral_vacios_bajo: 20,
        umbral_vacios_medio: 30,
        umbral_vacios_alto: 40,
        peso_apercibimiento: 8,
        peso_rotura: 5,
        peso_licencia: 10,
      };

  function calcScore(
    p: { km_con_carga: number; km_vacios: number },
    apercs: number,
    roturas: number,
    licActivas: number,
    pw: PesosScore,
  ): number | null {
    const total = p.km_con_carga + p.km_vacios;
    if (total === 0 && apercs === 0) return null;
    const pct = total > 0 ? (p.km_vacios / total) * 100 : 0;
    let s = 100;
    if (pct > pw.umbral_vacios_alto) s -= pw.peso_vacios_alto;
    else if (pct > pw.umbral_vacios_medio) s -= pw.peso_vacios_medio;
    else if (pct > pw.umbral_vacios_bajo) s -= pw.peso_vacios_bajo;
    s -= apercs * pw.peso_apercibimiento;
    s -= roturas * pw.peso_rotura;
    if (licActivas > 0) s -= pw.peso_licencia;
    return Math.max(0, Math.min(100, s));
  }

  // Score operativo del chofer actual (0-100, null si sin actividad)
  const viajes_count = viajesMesArr.length;
  const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;
  const score =
    viajes_count > 0
      ? calcScore(
          { km_con_carga, km_vacios },
          apercibimientos_mes,
          roturas_mes,
          licencias_activas,
          pesos,
        )
      : null;

  // Ranking: calcular score para todos los choferes activos con viajes este mes
  const rvArr = rankingViajes ?? [];
  const raArr = rankingApercs ?? [];
  const rrArr = rankingRoturas ?? [];
  const rlArr = rankingLicencias ?? [];

  // Agregar datos por chofer_id
  const rankMap = new Map<string, { km_con_carga: number; km_vacios: number; apercs: number; roturas: number; lic: number }>();
  for (const v of rvArr) {
    if (!v.chofer_id) continue;
    const e = rankMap.get(v.chofer_id) ?? { km_con_carga: 0, km_vacios: 0, apercs: 0, roturas: 0, lic: 0 };
    e.km_con_carga += Number(v.km_con_carga ?? 0);
    e.km_vacios += Number(v.km_vacios ?? 0);
    rankMap.set(v.chofer_id, e);
  }
  for (const a of raArr) {
    if (!a.chofer_id) continue;
    const e = rankMap.get(a.chofer_id) ?? { km_con_carga: 0, km_vacios: 0, apercs: 0, roturas: 0, lic: 0 };
    e.apercs += 1;
    rankMap.set(a.chofer_id, e);
  }
  for (const r of rrArr) {
    if (!r.chofer_id) continue;
    const e = rankMap.get(r.chofer_id) ?? { km_con_carga: 0, km_vacios: 0, apercs: 0, roturas: 0, lic: 0 };
    e.roturas += 1;
    rankMap.set(r.chofer_id, e);
  }
  for (const l of rlArr) {
    if (!l.chofer_id) continue;
    const e = rankMap.get(l.chofer_id) ?? { km_con_carga: 0, km_vacios: 0, apercs: 0, roturas: 0, lic: 0 };
    e.lic += 1;
    rankMap.set(l.chofer_id, e);
  }

  // Calcular scores y ordenar
  const rankScores: { chofer_id: string; score: number }[] = [];
  for (const [cid, stats] of rankMap.entries()) {
    const s = calcScore(stats, stats.apercs, stats.roturas, stats.lic, pesos);
    if (s !== null) rankScores.push({ chofer_id: cid, score: s });
  }
  rankScores.sort((a, b) => b.score - a.score);
  const ranking_total = rankScores.length;
  const rankIdx = rankScores.findIndex((r) => r.chofer_id === chofer_id);
  const ranking_pos = score !== null && rankIdx !== -1 ? rankIdx + 1 : null;

  // Liquidación al chofer del mes: suma del "$" del Excel de hoja de ruta (monto_chofer).
  const liquidacion_chofer_mes = (itemsLiquidacion ?? []).reduce(
    (acc, it) => acc + Number(it.monto_chofer ?? 0),
    0,
  );

  // Veces al taller: solo eventos no programados (reparación/avería + gomería).
  const TALLER_CODIGOS = new Set(["reparacion", "gomeria"]);
  const taller_visitas_mes = (mantenimientosMes ?? []).filter((m) => {
    const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
    const codigo = (ts as { codigo?: string } | null)?.codigo;
    if (codigo) return TALLER_CODIGOS.has(codigo);
    return m.tipo === "reparacion"; // fallback enum legacy (no tiene 'gomeria')
  }).length;

  // Eficiencia de combustible del mes (L/100km).
  const cargasComb = (cargasCombustibleMes ?? []).map((c) => ({
    camion_id: c.camion_id,
    km_odometro: c.km_odometro,
    litros: Number(c.litros),
  }));
  const { eficiencia: eficiencia_combustible } = calcularEficienciaPorDeltas(cargasComb);
  const litros_mes = cargasComb.reduce((a, c) => a + c.litros, 0);
  const cargas_combustible_count = cargasComb.length;

  const facturacion_por_km =
    facturacion_ars > 0 && km_con_carga > 0
      ? Math.round(facturacion_ars / km_con_carga)
      : null;

  const productividad_kpis: ProductividadKPIs = {
    periodo_desde: primerDia,
    periodo_hasta: ultimoDia,
    viajes_count,
    km_con_carga,
    km_vacios,
    km_total,
    pct_vacios,
    toneladas,
    utilizacion_pct,
    facturacion_ars,
    facturacion_usd,
    liquidacion_chofer_mes,
    adelantos_viaticos_ars,
    adelantos_viaticos_usd,
    eficiencia_combustible,
    litros_mes,
    cargas_combustible_count,
    taller_visitas_mes,
    roturas_mes,
    roturas_cantidad_mes,
    apercibimientos_mes,
    licencias_activas,
    licencias_dias_mes,
    prestamos_activos,
    facturacion_por_km,
    score,
    ranking_pos,
    ranking_total,
  };

  // Evolución 6 meses
  const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesesMap = new Map<string, { viajes: number; km_total: number; facturacion_ars: number; toneladas: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    mesesMap.set(key, { viajes: 0, km_total: 0, facturacion_ars: 0, toneladas: 0 });
  }
  for (const v of viajes6meses ?? []) {
    const key = v.fecha_viaje.slice(0, 7);
    const entry = mesesMap.get(key);
    if (entry) {
      entry.viajes += 1;
      entry.km_total += Number(v.km_con_carga ?? 0) + Number(v.km_vacios ?? 0);
      if (v.moneda === "ARS") entry.facturacion_ars += Number(v.monto_flete ?? 0);
      entry.toneladas += Number(v.tonelaje_real ?? 0);
    }
  }
  const evolucion_6meses: EvolucionMes[] = Array.from(mesesMap.entries()).map(([mes, datos]) => {
    const [y, m] = mes.split("-");
    const label = `${MESES_CORTOS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
    return { mes, label, ...datos };
  });

  const camiones_historial: CamionHistorialItem[] = (camionesHist ?? []).map((h) => {
    const cam = Array.isArray(h.camion) ? h.camion[0] : h.camion;
    const c = cam as { patente?: string; marca?: string | null; modelo?: string | null } | null;
    return {
      id: h.id,
      camion_id: h.camion_id,
      patente: c?.patente ?? "—",
      marca: c?.marca ?? null,
      modelo: c?.modelo ?? null,
      desde: h.desde,
      hasta: h.hasta,
      motivo_cambio: h.motivo_cambio,
    };
  });

  const adelantos_mes: AdelantoMes[] = viaticosArr.map((v) => {
    const vj = Array.isArray(v.viaje) ? v.viaje[0] : v.viaje;
    return {
      id: v.id,
      fecha_entrega: v.fecha_entrega,
      monto_adelanto: Number(v.monto_adelanto),
      moneda: v.moneda,
      viaje_codigo: (vj as { codigo?: string } | null)?.codigo ?? null,
    };
  });

  // Score de conducta del último trimestre (mismo cálculo que el Ranking).
  const scoreHasta = new Date().toISOString().split("T")[0]!;
  const scoreDesde = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    d.setDate(1);
    return d.toISOString().split("T")[0]!;
  })();
  const scoreRes = await computeScoreChofer(chofer_id, scoreDesde, scoreHasta);

  return ({
    ...chofer,
    score_trimestre: scoreRes?.score ?? null,
    score_trimestre_desglose: scoreRes?.desglose ?? [],
    foto: fotoObj as { bucket: string; path: string } | null,
    documentos_vigencia: mappedDocs,
    alertas: activeAlertsVisibles.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      severidad: a.severidad,
      titulo: a.titulo,
      mensaje: a.mensaje,
    })),
    tipos_documento: (tiposDoc ?? []).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      codigo: t.codigo,
    })),
    viajes_recientes: viajes ?? [],
    movimientos_mes: (movimientos ?? []).map((m) => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto,
      tipo: m.tipo as "ingreso" | "egreso",
      monto: m.monto,
      categoria: m.categoria,
    })),
    camion_actual: camionActual
      ? {
          id: camionActual.id,
          patente: camionActual.patente,
          marca: camionActual.marca,
          modelo: camionActual.modelo,
          ano: camionActual.ano,
        }
      : null,
    apercibimientos: apercibimientosRows.map((a) => {
      const cat = Array.isArray(a.categoria) ? a.categoria[0] : a.categoria;
      return {
        id: a.id,
        fecha: a.fecha,
        tipo: (a.tipo as string | null) ?? "apercibimiento",
        categoria_id: a.categoria_id,
        categoria_nombre: (cat as { nombre?: string } | null)?.nombre ?? null,
        motivo: a.motivo,
        observaciones: a.observaciones,
        created_at: a.created_at,
        archivo_url: apercArchivoMap.get(a.id)?.url ?? null,
        archivo_nombre: apercArchivoMap.get(a.id)?.nombre ?? null,
      };
    }),
    licencias_medicas: (licencias ?? []).map((l) => {
      const desde = new Date(l.fecha_desde);
      const hasta = l.fecha_hasta ? new Date(l.fecha_hasta) : null;
      const dias = hasta
        ? Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1)
        : null;
      return {
        id: l.id,
        fecha_desde: l.fecha_desde,
        fecha_hasta: l.fecha_hasta,
        motivo: l.motivo,
        observaciones: l.observaciones,
        dias,
        en_curso: !l.fecha_hasta,
        created_at: l.created_at,
      };
    }),
    prestamos: (prestamos ?? []).map((p) => ({
      id: p.id,
      fecha: p.fecha,
      monto: Number(p.monto),
      moneda: p.moneda,
      cuotas: p.cuotas,
      saldo_pendiente: Number(p.saldo_pendiente),
      estado: p.estado as PrestamoEstado,
      motivo: p.motivo,
      observaciones: p.observaciones,
      created_at: p.created_at,
    })),
    ausencias: (ausenciasRaw ?? []).map((a): Ausencia => {
      const aut = Array.isArray(a.autorizado) ? a.autorizado[0] : a.autorizado;
      const inicio = new Date(a.fecha_inicio + "T00:00:00");
      const fin = new Date(a.fecha_fin + "T00:00:00");
      const dias = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1);
      const hoyStr2 = new Date().toISOString().split("T")[0]!;
      return {
        id: a.id,
        tipo: a.tipo,
        fecha_inicio: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        estado: a.estado as AusenciaEstado,
        observaciones: a.observaciones,
        autorizado_por_nombre: aut ? `${aut.nombre}${aut.apellido ? " " + aut.apellido : ""}` : null,
        dias,
        en_curso: a.fecha_inicio <= hoyStr2 && a.fecha_fin >= hoyStr2,
        es_vacaciones: a.es_vacaciones ?? false,
        justificada: a.justificada ?? true,
        created_at: a.created_at,
      };
    }),
    vacaciones: (() => {
      const corresponden = vacacionesSaldoRaw?.dias_correspondientes ?? 0;
      const adeudados = vacacionesSaldoRaw?.dias_adeudados ?? 0;
      // Días tomados = suma de días de las vacaciones del período en curso
      // (fecha_inicio >= 1/1 del año actual). El saldo 2025 (adeudados) ya viene
      // neto de lo tomado en 2025, así que sólo contamos las del período vigente
      // para no descontar dos veces.
      const inicioPeriodo = `${new Date().getFullYear()}-01-01`;
      const tomados = (ausenciasRaw ?? [])
        .filter((a) => a.es_vacaciones && a.fecha_inicio >= inicioPeriodo)
        .reduce((acc, a) => {
          const ini = new Date(a.fecha_inicio + "T00:00:00");
          const fin = new Date(a.fecha_fin + "T00:00:00");
          return acc + Math.max(1, Math.round((fin.getTime() - ini.getTime()) / 86_400_000) + 1);
        }, 0);
      return {
        dias_correspondientes: corresponden,
        dias_adeudados: adeudados,
        dias_tomados: tomados,
        dias_disponibles: corresponden + adeudados - tomados,
      };
    })(),
    categorias_apercibimiento: categoriasApe ?? [],
    // Enmascarar montos de sueldo si no tiene la subsección confidencial (defensa en profundidad).
    productividad_kpis: canVerSueldos
      ? productividad_kpis
      : {
          ...productividad_kpis,
          liquidacion_chofer_mes: 0,
          adelantos_viaticos_ars: 0,
          adelantos_viaticos_usd: 0,
        },
    camiones_historial,
    roturas_detalle: (roturasDetalle ?? []).map((r) => {
      const cam = Array.isArray(r.camion) ? r.camion[0] : r.camion;
      const aco = Array.isArray(r.acoplado) ? r.acoplado[0] : r.acoplado;
      const camPat = (cam as { patente?: string } | null)?.patente ?? null;
      const acoPat = (aco as { patente?: string } | null)?.patente ?? null;
      return {
        id: r.id,
        fecha: r.fecha,
        cantidad: r.cantidad,
        costo: r.costo,
        moneda: r.moneda,
        posicion: r.posicion,
        observaciones: r.observaciones,
        unidad_patente: camPat ?? acoPat ?? null,
        unidad_tipo: (camPat ? "camion" : acoPat ? "acoplado" : null) as "camion" | "acoplado" | null,
      };
    }),
    adelantos_mes: canVerSueldos ? adelantos_mes : [],
    evolucion_6meses,
    pesos_score: pesos.id ? pesos : null,
    is_admin: user.rol.codigo === "admin",
    can_logistica_write: hasSeccion(user, "choferes", "write"),
    can_ver_sueldos: canVerSueldos,
  }) as unknown as ChoferDetail;
}

// ---------------------------------------------------------------------------
// Apercibimientos
// ---------------------------------------------------------------------------

const APERCIBIMIENTO_TIPOS = ["apercibimiento", "multa", "llamado_atencion", "adelanto"];

// Adjuntos del apercibimiento (acta, video, foto, etc.) — pueden ser VARIOS.
const APERCIBIMIENTO_CFG: AdjuntoCfg = {
  bucket: "documentos-personal",
  junctionTable: "apercibimiento_archivos",
  entityColumn: "apercibimiento_id",
  folder: "apercibimientos",
};

export async function crearUrlSubidaApercibimientoAction(input: {
  filename: string;
}): Promise<CrearUrlResult> {
  // Los apercibimientos los crea el admin (igual que crearApercibimientoAction).
  await requireAdmin();
  return crearUrlSubidaAdjunto(APERCIBIMIENTO_CFG, input.filename);
}

export async function getApercibimientoArchivosAction(id: string): Promise<AdjuntoExistente[]> {
  // Mismo gate que el legajo donde vive el apercibimiento (getChoferDetailAction).
  await requireSeccion("choferes", "read");
  return getAdjuntos(APERCIBIMIENTO_CFG, id);
}

export async function deleteApercibimientoArchivoAction(
  adjuntoId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const res = await deleteAdjunto(APERCIBIMIENTO_CFG, adjuntoId);
  revalidatePath("/choferes/[slug]", "page");
  return res;
}

// Sumar archivos a un apercibimiento YA creado (ej: cargar el video después del acta).
export async function agregarApercibimientoArchivosAction(
  apercibimientoId: string,
  adjuntos: AdjuntoArchivoMeta[],
): Promise<{ ok: boolean; vinculados?: number; fallidos?: number; error?: string }> {
  const user = await requireAdmin();
  if (!apercibimientoId || !adjuntos?.length) return { ok: false, error: "No hay archivos para agregar." };
  const r = await vincularAdjuntos(APERCIBIMIENTO_CFG, apercibimientoId, adjuntos, user.id);
  revalidatePath("/choferes/[slug]", "page");
  return { ok: true, vinculados: r.vinculados, fallidos: r.fallidos };
}

export async function crearApercibimientoAction(
  chofer_id: string,
  data: {
    fecha: string;
    tipo?: string;
    categoria_id: string | null;
    motivo: string;
    observaciones?: string | null;
    adjuntos?: AdjuntoArchivoMeta[] | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!data.motivo.trim()) return { error: "El motivo es obligatorio" };
  const tipo = APERCIBIMIENTO_TIPOS.includes(data.tipo ?? "") ? data.tipo! : "apercibimiento";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nuevo, error } = await (supabase as any)
    .from("chofer_apercibimientos")
    .insert({
      chofer_id,
      fecha: data.fecha,
      tipo,
      categoria_id: data.categoria_id,
      motivo: data.motivo.trim(),
      observaciones: data.observaciones?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !nuevo) {
    // Si falla el alta, limpiamos del Storage los archivos ya subidos (quedarían huérfanos).
    for (const a of data.adjuntos ?? []) {
      if (a?.path) await supabase.storage.from(a.bucket).remove([a.path]).then(undefined, () => {});
    }
    return { error: "No se pudo registrar el apercibimiento" };
  }

  // Vincular los archivos adjuntos (acta, video, etc.) — pueden ser varios.
  let adjuntosFallidos = 0;
  if (data.adjuntos?.length) {
    const r = await vincularAdjuntos(APERCIBIMIENTO_CFG, nuevo.id, data.adjuntos, user.id);
    adjuntosFallidos = r.fallidos;
  }

  await logChoferAudit(
    chofer_id,
    "apercibimiento_creado",
    null,
    {
      fecha: data.fecha,
      motivo: data.motivo.trim(),
    },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return adjuntosFallidos > 0 ? { success: true, adjuntosFallidos } : { success: true };
}

export async function eliminarApercibimientoAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_apercibimientos")
    .select("fecha, motivo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_apercibimientos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el apercibimiento" };

  await logChoferAudit(chofer_id, "apercibimiento_eliminado", previo, null, user.id);
  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Licencias médicas
// ---------------------------------------------------------------------------

export async function crearLicenciaAction(
  chofer_id: string,
  data: {
    fecha_desde: string;
    fecha_hasta?: string | null;
    motivo?: string | null;
    observaciones?: string | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (data.fecha_hasta && data.fecha_hasta < data.fecha_desde)
    return { error: "La fecha hasta no puede ser anterior a desde" };

  const { error } = await supabase.from("chofer_licencias_medicas").insert({
    chofer_id,
    fecha_desde: data.fecha_desde,
    fecha_hasta: data.fecha_hasta || null,
    motivo: data.motivo?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    created_by: user.id,
  });

  if (error) return { error: "No se pudo registrar la licencia" };

  await logChoferAudit(
    chofer_id,
    "licencia_creada",
    null,
    {
      fecha_desde: data.fecha_desde,
      fecha_hasta: data.fecha_hasta || null,
      motivo: data.motivo?.trim() || null,
    },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

export async function cerrarLicenciaAction(id: string, chofer_id: string, fecha_hasta: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_licencias_medicas")
    .select("fecha_desde, fecha_hasta")
    .eq("id", id)
    .single();

  if (previo && fecha_hasta < previo.fecha_desde)
    return { error: "La fecha hasta no puede ser anterior a desde" };

  const { error } = await supabase
    .from("chofer_licencias_medicas")
    .update({ fecha_hasta, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No se pudo cerrar la licencia" };

  await logChoferAudit(
    chofer_id,
    "licencia_cerrada",
    previo,
    { ...previo, fecha_hasta },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

export async function eliminarLicenciaAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_licencias_medicas")
    .select("fecha_desde, fecha_hasta, motivo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_licencias_medicas").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar la licencia" };

  await logChoferAudit(chofer_id, "licencia_eliminada", previo, null, user.id);
  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ausencias / permisos programados
// Crear = autorizar (queda registrado quién autorizó). Cancelar = soft delete.
// ---------------------------------------------------------------------------

// Detecta si el chofer ya tiene una ausencia (no cancelada) que se pisa con el
// rango pedido. Dos rangos [a,b] y [c,d] se solapan si a <= d && b >= c.
// `excluirId` permite ignorar la propia ausencia al editar.
async function ausenciaSolapadaError(
  supabase: ReturnType<typeof createAdminClient>,
  chofer_id: string,
  fecha_inicio: string,
  fecha_fin: string,
  excluirId?: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("chofer_ausencias")
    .select("fecha_inicio, fecha_fin, tipo")
    .eq("chofer_id", chofer_id)
    .is("deleted_at", null)
    .lte("fecha_inicio", fecha_fin)
    .gte("fecha_fin", fecha_inicio);
  if (excluirId) query = query.neq("id", excluirId);

  const { data } = await query;
  const choque = (data ?? [])[0] as { fecha_inicio: string; fecha_fin: string; tipo: string } | undefined;
  if (!choque) return null;

  return `Ya hay una ausencia cargada que se solapa con estas fechas: "${choque.tipo}" (${formatFechaCorta(choque.fecha_inicio)} → ${formatFechaCorta(choque.fecha_fin)}).`;
}

// dd/mm para mensajes de error (sin dependencias de cliente).
function formatFechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

export async function crearAusenciaAction(
  chofer_id: string,
  data: {
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    observaciones?: string | null;
    es_vacaciones?: boolean;
    justificada?: boolean;
  },
) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const tipo = data.tipo.trim();
  if (!tipo) return { error: "El tipo de ausencia es obligatorio" };
  if (!data.fecha_inicio || !data.fecha_fin) return { error: "Las fechas son obligatorias" };
  if (data.fecha_fin < data.fecha_inicio)
    return { error: "La fecha de fin no puede ser anterior al inicio" };

  const solape = await ausenciaSolapadaError(supabase, chofer_id, data.fecha_inicio, data.fecha_fin);
  if (solape) return { error: solape };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("chofer_ausencias").insert({
    chofer_id,
    tipo,
    fecha_inicio: data.fecha_inicio,
    fecha_fin: data.fecha_fin,
    estado: "autorizada",
    autorizado_por: user.id,
    observaciones: data.observaciones?.trim() || null,
    es_vacaciones: data.es_vacaciones ?? false,
    justificada: data.justificada ?? true,
    created_by: user.id,
  });

  if (error) return { error: "No se pudo registrar la ausencia" };

  await logChoferAudit(
    chofer_id,
    "ausencia_creada",
    null,
    { tipo, fecha_inicio: data.fecha_inicio, fecha_fin: data.fecha_fin },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/viajes");
  revalidatePath("/choferes/vacaciones");
  return { success: true };
}

export async function editarAusenciaAction(
  id: string,
  chofer_id: string,
  data: {
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    observaciones?: string | null;
    es_vacaciones?: boolean;
    justificada?: boolean;
  },
) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const tipo = data.tipo.trim();
  if (!tipo) return { error: "El tipo de ausencia es obligatorio" };
  if (!data.fecha_inicio || !data.fecha_fin) return { error: "Las fechas son obligatorias" };
  if (data.fecha_fin < data.fecha_inicio)
    return { error: "La fecha de fin no puede ser anterior al inicio" };

  const solape = await ausenciaSolapadaError(
    supabase,
    chofer_id,
    data.fecha_inicio,
    data.fecha_fin,
    id,
  );
  if (solape) return { error: solape };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: previo } = await sb
    .from("chofer_ausencias")
    .select("tipo, fecha_inicio, fecha_fin, observaciones")
    .eq("id", id)
    .single();

  const nuevos = {
    tipo,
    fecha_inicio: data.fecha_inicio,
    fecha_fin: data.fecha_fin,
    observaciones: data.observaciones?.trim() || null,
    es_vacaciones: data.es_vacaciones ?? false,
    justificada: data.justificada ?? true,
  };

  const { error } = await sb.from("chofer_ausencias").update(nuevos).eq("id", id);
  if (error) return { error: "No se pudo actualizar la ausencia" };

  await logChoferAudit(chofer_id, "ausencia_editada", previo ?? null, nuevos, user.id);

  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/viajes");
  revalidatePath("/choferes/vacaciones");
  return { success: true };
}

export async function cancelarAusenciaAction(id: string, chofer_id: string) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: previo } = await sb
    .from("chofer_ausencias")
    .select("tipo, fecha_inicio, fecha_fin")
    .eq("id", id)
    .single();

  // Soft delete: preserva trazabilidad histórica.
  const { error } = await sb
    .from("chofer_ausencias")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo cancelar la ausencia" };

  await logChoferAudit(chofer_id, "ausencia_cancelada", previo ?? null, null, user.id);

  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/viajes");
  revalidatePath("/choferes/vacaciones");
  return { success: true };
}

// Guarda/actualiza el saldo de vacaciones del chofer (días que le corresponden del
// período + días adeudados de períodos anteriores). Los "tomados" no se cargan acá:
// se calculan a partir de las ausencias marcadas como vacaciones.
export async function guardarSaldoVacacionesAction(
  chofer_id: string,
  data: { dias_correspondientes: number; dias_adeudados: number; observaciones?: string | null },
) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const corresponden = Math.trunc(Number(data.dias_correspondientes));
  const adeudados = Math.trunc(Number(data.dias_adeudados));
  if (!Number.isFinite(corresponden) || corresponden < 0)
    return { error: "Los días que corresponden deben ser un número válido (0 o más)." };
  if (!Number.isFinite(adeudados) || adeudados < 0)
    return { error: "Los días adeudados deben ser un número válido (0 o más)." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: previo } = await sb
    .from("chofer_vacaciones")
    .select("dias_correspondientes, dias_adeudados")
    .eq("chofer_id", chofer_id)
    .maybeSingle();

  const { error } = await sb.from("chofer_vacaciones").upsert(
    {
      chofer_id,
      dias_correspondientes: corresponden,
      dias_adeudados: adeudados,
      observaciones: data.observaciones?.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chofer_id" },
  );
  if (error) return { error: "No se pudo guardar el saldo de vacaciones." };

  await logChoferAudit(
    chofer_id,
    previo ? "vacaciones_saldo_editado" : "vacaciones_saldo_creado",
    previo ?? null,
    { dias_correspondientes: corresponden, dias_adeudados: adeudados },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/choferes/vacaciones");
  return { success: true };
}

// Viajes del chofer dentro de un rango de fechas. Read protegida por la página
// padre (legajo, requireArea logística read). Sirve para avisar de conflictos al
// cargar una ausencia: si el chofer ya tiene viajes esos días, se listan.
export async function getViajesChoferEnRangoAction(
  chofer_id: string,
  desde: string,
  hasta: string,
): Promise<ViajeEnRango[]> {
  if (!chofer_id || !desde || !hasta || hasta < desde) return [];
  const supabase = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("viajes")
    .select(
      `id, codigo, fecha_viaje, estado, observaciones,
       clientes(razon_social),
       origen:puntos_ruta!viajes_origen_id_fkey(nombre),
       destino:puntos_ruta!viajes_destino_id_fkey(nombre)`,
    )
    .eq("chofer_id", chofer_id)
    .neq("estado", "cancelado")
    .gte("fecha_viaje", desde)
    .lte("fecha_viaje", hasta)
    .order("fecha_viaje", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((v: any): ViajeEnRango => {
    let oName: string | null = v.origen?.nombre ?? null;
    let dName: string | null = v.destino?.nombre ?? null;
    if (!oName && v.observaciones) {
      const m = v.observaciones.match(/Origen:\s*([^|]+)/);
      if (m) oName = m[1].trim();
    }
    if (!dName && v.observaciones) {
      const m = v.observaciones.match(/Destino:\s*([^|]+)/);
      if (m) dName = m[1].trim();
    }
    return {
      id: v.id,
      codigo: v.codigo,
      fecha_viaje: v.fecha_viaje,
      origen: oName,
      destino: dName,
      cliente: v.clientes?.razon_social ?? null,
      estado: v.estado,
    };
  });
}

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------

export async function crearPrestamoAction(
  chofer_id: string,
  data: {
    fecha: string;
    monto: number;
    cuotas: number;
    motivo?: string | null;
    observaciones?: string | null;
  },
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!Number.isFinite(data.monto) || data.monto <= 0)
    return { error: "El monto debe ser mayor a cero" };
  if (!Number.isInteger(data.cuotas) || data.cuotas < 1)
    return { error: "Las cuotas deben ser un entero mayor o igual a 1" };

  const { error } = await supabase.from("chofer_prestamos").insert({
    chofer_id,
    fecha: data.fecha,
    monto: data.monto,
    cuotas: data.cuotas,
    saldo_pendiente: data.monto,
    motivo: data.motivo?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    created_by: user.id,
  });

  if (error) return { error: "No se pudo registrar el préstamo" };

  await logChoferAudit(
    chofer_id,
    "prestamo_creado",
    null,
    {
      fecha: data.fecha,
      monto: data.monto,
      cuotas: data.cuotas,
    },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

export async function actualizarSaldoPrestamoAction(
  id: string,
  chofer_id: string,
  nuevo_saldo: number,
) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  if (!Number.isFinite(nuevo_saldo) || nuevo_saldo < 0)
    return { error: "El saldo no puede ser negativo" };

  const { data: previo } = await supabase
    .from("chofer_prestamos")
    .select("monto, saldo_pendiente, estado")
    .eq("id", id)
    .single();

  if (!previo) return { error: "Préstamo no encontrado" };
  if (nuevo_saldo > Number(previo.monto))
    return { error: "El saldo no puede superar el monto original" };

  const estado: PrestamoEstado =
    nuevo_saldo === 0 ? "cancelado" : nuevo_saldo < Number(previo.monto) ? "parcial" : "pendiente";

  const { error } = await supabase
    .from("chofer_prestamos")
    .update({
      saldo_pendiente: nuevo_saldo,
      estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo actualizar el saldo" };

  await logChoferAudit(
    chofer_id,
    "prestamo_saldo_actualizado",
    { saldo_pendiente: Number(previo.saldo_pendiente), estado: previo.estado },
    { saldo_pendiente: nuevo_saldo, estado },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

export async function eliminarPrestamoAction(id: string, chofer_id: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_prestamos")
    .select("fecha, monto, cuotas, saldo_pendiente")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("chofer_prestamos").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar el préstamo" };

  await logChoferAudit(chofer_id, "prestamo_eliminado", previo, null, user.id);
  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

/**
 * Genera una URL firmada para subir un archivo DIRECTO del navegador al Storage
 * (bucket documentos-personal), sin pasar el archivo por el Server Action. Así
 * se evita el límite de body de Vercel (~4,5 MB) que dejaba la subida colgada.
 * El cliente sube con esta URL y después llama a registrar/actualizar con los
 * metadatos del archivo ya subido.
 */
export async function crearUrlSubidaDocumentoAction(input: {
  chofer_id: string;
  filename: string;
}): Promise<
  | { signedUrl: string; token: string; path: string; bucket: string }
  | { error: string }
> {
  await requireArea("logistica", "write");
  const supabase = createAdminClient();

  if (!input.chofer_id) return { error: "Falta el chofer" };

  const bucket = "documentos-personal";
  const ext = (input.filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `choferes/${input.chofer_id}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { error: "No se pudo iniciar la subida del archivo" };

  return { signedUrl: data.signedUrl, token: data.token, path, bucket };
}

// Adjuntos de un documento del chofer — VARIOS archivos por documento (ej: frente
// y dorso del carnet, o el documento + un anexo).
const CHOFER_DOC_CFG: AdjuntoCfg = {
  bucket: "documentos-personal",
  junctionTable: "chofer_documento_archivos",
  entityColumn: "chofer_documento_id",
  folder: "choferes",
};

export async function getChoferDocumentoArchivosAction(docId: string): Promise<AdjuntoExistente[]> {
  await requireSeccion("choferes", "read");
  return getAdjuntos(CHOFER_DOC_CFG, docId);
}

export async function deleteChoferDocumentoArchivoAction(
  adjuntoId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireArea("logistica", "write");
  const res = await deleteAdjunto(CHOFER_DOC_CFG, adjuntoId);
  revalidatePath("/choferes/[slug]", "page");
  return res;
}

/**
 * Registra en la base un documento de chofer cuyo archivo YA fue subido al
 * Storage vía `crearUrlSubidaDocumentoAction` + subida directa. Solo recibe
 * metadatos (payload chico), nunca el binario.
 */
export async function registrarDocumentoChoferAction(input: {
  chofer_id: string;
  tipo_documento_id?: string | null;
  tipo_nombre_custom?: string | null;
  numero?: string | null;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  adjuntos?: AdjuntoArchivoMeta[];
}) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const { chofer_id } = input;
  const adjuntos = input.adjuntos ?? [];
  let tipo_documento_id = input.tipo_documento_id ?? "";

  // Si algo falla antes de vincular, borramos los huérfanos del Storage.
  const limpiarAdjuntos = async () => {
    for (const a of adjuntos) {
      if (a?.path) await supabase.storage.from(a.bucket).remove([a.path]).then(undefined, () => {});
    }
  };

  // Si el usuario eligió "Otro", buscar o crear el tipo de documento
  if (input.tipo_nombre_custom) {
    const nombreNorm = input.tipo_nombre_custom.trim();
    if (!nombreNorm) {
      await limpiarAdjuntos();
      return { error: "El nombre del tipo de documento no puede estar vacío" };
    }

    const { data: existente } = await supabase
      .from("tipos_documento")
      .select("id")
      .eq("nombre", nombreNorm)
      .eq("aplica_a", "chofer")
      .maybeSingle();

    if (existente) {
      tipo_documento_id = existente.id;
    } else {
      const codigoBase = nombreNorm
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
        .slice(0, 30);

      const { data: nuevo, error: crearError } = await supabase
        .from("tipos_documento")
        .insert({
          nombre: nombreNorm,
          codigo: `CUSTOM_${codigoBase}_${Date.now()}`,
          aplica_a: "chofer",
          estado: "activo",
        })
        .select("id")
        .single();

      if (crearError || !nuevo) {
        await limpiarAdjuntos();
        return { error: "No se pudo crear el tipo de documento" };
      }
      tipo_documento_id = nuevo.id;
    }
  }

  if (!tipo_documento_id) {
    await limpiarAdjuntos();
    return { error: "Tipo de documento requerido" };
  }

  const { data: nuevoDoc, error: dbError } = await supabase
    .from("chofer_documentos")
    .insert({
      chofer_id,
      tipo_documento_id,
      numero: input.numero || null,
      fecha_emision: input.fecha_emision || null,
      fecha_vencimiento: input.fecha_vencimiento || null,
    })
    .select("id")
    .single();
  if (dbError || !nuevoDoc) {
    await limpiarAdjuntos();
    return { error: "No se pudo guardar el documento" };
  }

  // Vincular los archivos (pueden ser varios).
  let adjuntosFallidos = 0;
  if (adjuntos.length) {
    const r = await vincularAdjuntos(CHOFER_DOC_CFG, nuevoDoc.id, adjuntos, user.id);
    adjuntosFallidos = r.fallidos;
  }

  const { data: tipoDoc } = await supabase
    .from("tipos_documento")
    .select("nombre")
    .eq("id", tipo_documento_id)
    .single();

  await logChoferAudit(
    chofer_id,
    "documento_agregado",
    null,
    {
      tipo_documento: tipoDoc?.nombre ?? null,
      archivos: adjuntos.length,
      numero: input.numero || null,
      fecha_emision: input.fecha_emision || null,
      fecha_vencimiento: input.fecha_vencimiento || null,
    },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return adjuntosFallidos > 0 ? { success: true, adjuntosFallidos } : { success: true };
}

export async function updateDocumentoChoferAction(input: {
  id: string;
  chofer_id: string;
  tipo_documento_id?: string | null;
  numero?: string | null;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  /** Archivos nuevos a sumar al documento (los existentes se borran uno a uno
   *  desde la lista de adjuntos, no acá). */
  adjuntos_nuevos?: AdjuntoArchivoMeta[];
}) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const { id, chofer_id } = input;
  if (!id) return { error: "ID de documento requerido" };

  const { data: previo } = await supabase
    .from("chofer_documentos")
    .select("numero, fecha_emision, fecha_vencimiento, tipo_documento_id")
    .eq("id", id)
    .single();

  if (!previo) return { error: "Documento no encontrado" };

  const { error: dbError } = await supabase
    .from("chofer_documentos")
    .update({
      numero: input.numero || null,
      fecha_emision: input.fecha_emision || null,
      fecha_vencimiento: input.fecha_vencimiento || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (dbError) return { error: "Error al actualizar el documento" };

  // Vincular los archivos nuevos agregados en la edición (varios).
  let adjuntosFallidos = 0;
  if (input.adjuntos_nuevos?.length) {
    const r = await vincularAdjuntos(CHOFER_DOC_CFG, id, input.adjuntos_nuevos, user.id);
    adjuntosFallidos = r.fallidos;
  }

  const { data: tipoDoc } = await supabase
    .from("tipos_documento")
    .select("nombre")
    .eq("id", input.tipo_documento_id ?? previo.tipo_documento_id)
    .single();

  await logChoferAudit(
    chofer_id,
    "documento_actualizado",
    previo,
    {
      tipo_documento: tipoDoc?.nombre ?? null,
      archivos_nuevos: input.adjuntos_nuevos?.length ?? 0,
      numero: input.numero || null,
      fecha_emision: input.fecha_emision || null,
      fecha_vencimiento: input.fecha_vencimiento || null,
    },
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return adjuntosFallidos > 0 ? { success: true, adjuntosFallidos } : { success: true };
}

export async function updateChoferInfoAction(
  chofer_id: string,
  data: Partial<{
    nombre: string;
    apellido: string;
    telefono: string;
    domicilio: string;
    cbu: string;
    alias_cbu: string;
    banco: string;
    telefono_emergencia: string;
    ciudad_nacimiento: string;
    localidad: string;
    provincia: string;
    alta_afip: string;
    periodo_prueba_fin: string;
    rol: string;
  }>
) {

  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const camposEditables = Object.keys(data) as (keyof typeof data)[];
  const { data: previo } = await supabase
    .from("choferes")
    .select(camposEditables.join(", "))
    .eq("id", chofer_id)
    .single();

  const { error } = await supabase
    .from("choferes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", chofer_id);
  if (error) return { error: "Error al actualizar" };

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "actualizar",
    entidad_tipo: "chofer",
    entidad_id: chofer_id,
    valores_anteriores: previo ?? null,
    valores_nuevos: data,
  });

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Asignación de camión (chofer ↔ camión)
// El trigger `camiones_sync_chofer_historial` mantiene chofer_camion_historial
// automáticamente cuando cambia camiones.chofer_actual_id, así que acá solo
// tocamos ese campo.
// ---------------------------------------------------------------------------

export type CamionAsignable = {
  id: string;
  patente: string;
  /** Nombre del chofer que hoy tiene el camión (o null si está libre). */
  chofer_nombre: string | null;
  /** El actual dueño está dado de baja (egresado): sirve para avisar mejor. */
  chofer_egresado: boolean;
};

export async function listCamionesAsignablesAction(): Promise<CamionAsignable[]> {
  await requireArea("logistica", "read");
  const supabase = createAdminClient();
  const [{ data: camiones }, { data: choferes }] = await Promise.all([
    // Solo camiones activos: no tiene sentido asignar una unidad de baja.
    supabase.from("camiones").select("id, patente, chofer_actual_id").eq("estado", "activo").order("patente"),
    supabase.from("choferes").select("id, nombre, apellido, estado"),
  ]);
  const infoPorId = new Map<string, { nombre: string; egresado: boolean }>();
  for (const c of choferes ?? [])
    infoPorId.set(c.id, { nombre: `${c.apellido}, ${c.nombre}`, egresado: c.estado === "baja" });
  return (camiones ?? []).map((c) => {
    const info = c.chofer_actual_id ? infoPorId.get(c.chofer_actual_id) : null;
    return {
      id: c.id,
      patente: c.patente,
      chofer_nombre: info?.nombre ?? null,
      chofer_egresado: info?.egresado ?? false,
    };
  });
}

export type CamionAsignadoResult = {
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
};

/**
 * Asigna un camión a un chofer. Si el camión lo tenía OTRO chofer, se lo quita
 * (ese chofer queda sin camión): `camiones.chofer_actual_id` es la única fuente
 * de verdad de la asignación fija, y el trigger de historial cierra el tramo del
 * dueño anterior y abre el nuevo. Devuelve el camión asignado y a quién se le
 * quitó, para que la UI lo muestre sin depender del refetch.
 */
export async function asignarCamionAction(
  chofer_id: string,
  camion_id: string,
): Promise<{ ok?: boolean; error?: string; camion?: CamionAsignadoResult; quitadoA?: string | null }> {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  // Dueño anterior del camión (para avisar "se lo quitaste a X").
  const { data: prev } = await supabase
    .from("camiones")
    .select("id, chofer_actual_id")
    .eq("id", camion_id)
    .maybeSingle();
  if (!prev) return { error: "No se encontró el camión seleccionado." };
  const prevOwnerId = (prev as { chofer_actual_id: string | null }).chofer_actual_id;

  // El chofer no puede quedar en dos camiones: liberar cualquier otro que tenga.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: freeErr } = await (supabase as any)
    .from("camiones")
    .update({ chofer_actual_id: null })
    .eq("chofer_actual_id", chofer_id)
    .neq("id", camion_id);
  if (freeErr) return { error: "No se pudo liberar el camión anterior del chofer." };

  // Asignar (si lo tenía otro, se lo quita automáticamente al pisar la columna).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("camiones")
    .update({ chofer_actual_id: chofer_id })
    .eq("id", camion_id);
  if (error) return { error: error.message };

  let quitadoA: string | null = null;
  if (prevOwnerId && prevOwnerId !== chofer_id) {
    const { data: ex } = await supabase
      .from("choferes")
      .select("nombre, apellido")
      .eq("id", prevOwnerId)
      .maybeSingle();
    if (ex) quitadoA = `${ex.apellido}, ${ex.nombre}`;
  }

  const { data: cam } = await supabase
    .from("camiones")
    .select("id, patente, marca, modelo, ano")
    .eq("id", camion_id)
    .maybeSingle();

  await logChoferAudit(
    chofer_id,
    "camion_asignado",
    prevOwnerId ? { quitado_a: prevOwnerId } : null,
    { camion_id },
    user.id,
  );
  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/choferes");
  revalidatePath("/viajes/planilla-diaria");
  revalidatePath("/viajes/carga-rapida");
  revalidatePath("/camiones");
  return { ok: true, camion: (cam as CamionAsignadoResult) ?? undefined, quitadoA };
}

export async function desasignarCamionAction(
  chofer_id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("camiones")
    .update({ chofer_actual_id: null })
    .eq("chofer_actual_id", chofer_id);
  if (error) return { error: error.message };
  await logChoferAudit(chofer_id, "camion_desasignado", null, null, user.id);
  revalidatePath("/choferes/[slug]", "page");
  revalidatePath("/choferes");
  revalidatePath("/viajes/planilla-diaria");
  revalidatePath("/viajes/carga-rapida");
  revalidatePath("/camiones");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Editar información del egreso (motivo, fecha, observaciones) de un chofer dado
// de baja. Permite corregir el egreso cargado al dar la baja.
// ---------------------------------------------------------------------------
export async function updateEgresoAction(
  chofer_id: string,
  data: { motivo_egreso?: string | null; fecha_egreso?: string | null; observaciones?: string | null },
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {};
  if (data.motivo_egreso !== undefined) payload.motivo_egreso = data.motivo_egreso || null;
  if (data.fecha_egreso !== undefined) payload.fecha_egreso = data.fecha_egreso || null;
  if (data.observaciones !== undefined) payload.observaciones = data.observaciones || null;
  if (Object.keys(payload).length === 0) return { ok: true };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("choferes").update(payload).eq("id", chofer_id);
  if (error) return { error: error.message };
  await logChoferAudit(chofer_id, "egreso_editado", null, payload, user.id);
  revalidatePath("/choferes");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Configuración de pesos del score de productividad (solo admin)
// ---------------------------------------------------------------------------

export async function updatePesosScoreAction(
  data: Omit<PesosScore, "id">,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const vals = [
    data.peso_vacios_bajo, data.peso_vacios_medio, data.peso_vacios_alto,
    data.peso_apercibimiento, data.peso_rotura, data.peso_licencia,
  ];
  if (vals.some((v) => !Number.isFinite(v) || v < 0))
    return { error: "Los pesos deben ser números no negativos" };
  if (!(data.umbral_vacios_bajo < data.umbral_vacios_medio && data.umbral_vacios_medio < data.umbral_vacios_alto))
    return { error: "Los umbrales de km vacíos deben ser ascendentes" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing } = await sb.from("pesos_score_chofer").select("id").limit(1).maybeSingle();

  if (existing?.id) {
    const { error } = await sb
      .from("pesos_score_chofer")
      .update({ ...data, actualizado_por: user.id })
      .eq("id", existing.id);
    if (error) return { error: "No se pudieron guardar los pesos" };
  } else {
    const { error } = await sb
      .from("pesos_score_chofer")
      .insert({ ...data, actualizado_por: user.id });
    if (error) return { error: "No se pudieron guardar los pesos" };
  }

  await supabase.from("audit_log").insert({
    usuario_id: user.id,
    accion: "actualizar",
    entidad_tipo: "pesos_score_chofer",
    entidad_id: existing?.id ?? null,
    valores_anteriores: null,
    valores_nuevos: data,
  });

  revalidatePath("/choferes/[slug]", "page");
  return { ok: true };
}

export async function deleteDocumentoAction(doc_id: string, chofer_id: string) {
  const user = await requireArea("logistica", "write");
  const supabase = createAdminClient();

  const { data: previo } = await supabase
    .from("chofer_documentos")
    .select(
      "numero, fecha_emision, fecha_vencimiento, tipo_documento_id, archivo_id",
    )
    .eq("id", doc_id)
    .single();

  let tipoNombre: string | null = null;
  let archivoNombre: string | null = null;
  if (previo?.tipo_documento_id) {
    const { data: tipoDoc } = await supabase
      .from("tipos_documento")
      .select("nombre")
      .eq("id", previo.tipo_documento_id)
      .single();
    tipoNombre = tipoDoc?.nombre ?? null;
  }
  if (previo?.archivo_id) {
    const { data: arch } = await supabase
      .from("documentos_archivos")
      .select("nombre_original")
      .eq("id", previo.archivo_id)
      .single();
    archivoNombre = arch?.nombre_original ?? null;
  }

  const { error } = await supabase
    .from("chofer_documentos")
    .delete()
    .eq("id", doc_id);
  if (error) return { error: "No se pudo eliminar el documento" };

  await logChoferAudit(
    chofer_id,
    "documento_eliminado",
    {
      tipo_documento: tipoNombre,
      archivo: archivoNombre,
      numero: previo?.numero ?? null,
      fecha_emision: previo?.fecha_emision ?? null,
      fecha_vencimiento: previo?.fecha_vencimiento ?? null,
    },
    null,
    user.id,
  );

  revalidatePath("/choferes/[slug]", "page");
  return { success: true };
}
