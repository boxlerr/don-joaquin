import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRITERIO_CLAVE, RANKING_CRITERIOS_DEFAULT, type RankingCriterios } from "./criterios";

export { RANKING_CRITERIOS_DEFAULT, CRITERIO_CLAVE };
export type { RankingCriterios };

export type RankingChofer = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  viajes_count: number;
  km_con_carga: number;
  km_vacios: number;
  km_total: number;
  pct_vacios: number;
  apercibimientos_count: number;
  roturas_count: number;
  taller_count: number;
  siniestros_count: number;
  ausencias_injustificadas_count: number;
  licencias_activas: number;
  facturacion_total: number;
  pesos_por_km: number | null;
  score: number | null;
  // Penalizaciones aplicadas (para el desglose "por qué" del score).
  desglose: { label: string; puntos: number }[];
};

export type ScoreDesglose = { label: string; puntos: number };

/** Calcula score (0-100) + desglose a partir de los conteos del período.
 * Único lugar donde vive la lógica de penalización (lo usan el ranking y el
 * score individual del legajo, así nunca se desincronizan). */
export function calcularScore(
  cnt: {
    pct_vacios: number;
    apercibimientos: number;
    roturas: number;
    siniestros: number;
    ausencias_injust: number;
    taller: number;
    licencias_activas: number;
  },
  p: RankingCriterios,
): { score: number; desglose: ScoreDesglose[] } {
  const desglose: ScoreDesglose[] = [];
  let s = 100;

  let penVacios = 0;
  let labelVacios = "";
  if (cnt.pct_vacios > 40) {
    penVacios = p.vacios_alto;
    labelVacios = `Km vacíos ${cnt.pct_vacios.toFixed(0)}% (más del 40%)`;
  } else if (cnt.pct_vacios > 30) {
    penVacios = p.vacios_moderado;
    labelVacios = `Km vacíos ${cnt.pct_vacios.toFixed(0)}% (30–40%)`;
  } else if (cnt.pct_vacios > 20) {
    penVacios = p.vacios_leve;
    labelVacios = `Km vacíos ${cnt.pct_vacios.toFixed(0)}% (20–30%)`;
  }
  if (penVacios > 0) {
    desglose.push({ label: labelVacios, puntos: -penVacios });
    s -= penVacios;
  }
  const restar = (c: number, peso: number, label: string) => {
    const total = c * peso;
    if (total > 0) {
      desglose.push({ label: `${label} (${c})`, puntos: -total });
      s -= total;
    }
  };
  restar(cnt.siniestros, p.siniestro, "Siniestros");
  restar(cnt.apercibimientos, p.aperc, "Apercibimientos");
  restar(cnt.ausencias_injust, p.ausencia_injust, "Ausencias injustificadas");
  restar(cnt.roturas, p.rotura, "Roturas");
  restar(cnt.taller, p.taller, "Visitas al taller");
  if (cnt.licencias_activas > 0) {
    desglose.push({ label: "Licencia médica activa", puntos: -p.licencia });
    s -= p.licencia;
  }
  return { score: Math.max(0, Math.min(100, s)), desglose };
}

export async function getRankingCriterios(): Promise<RankingCriterios> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .in("clave", Object.values(CRITERIO_CLAVE));

  const map = new Map((data ?? []).map((r) => [r.clave, Number(r.valor)]));
  const criterios = { ...RANKING_CRITERIOS_DEFAULT };
  for (const k of Object.keys(CRITERIO_CLAVE) as (keyof RankingCriterios)[]) {
    const v = map.get(CRITERIO_CLAVE[k]);
    if (Number.isFinite(v)) criterios[k] = v as number;
  }
  return criterios;
}

type ViajeMetricaRow = {
  chofer_id: string | null;
  km_con_carga: number | null;
  km_vacios: number | null;
  monto_flete: number | null;
  moneda: string | null;
  tipo_cambio: number | null;
};

/**
 * Trae TODOS los viajes para métricas, paginando de a 1000 (PostgREST corta la
 * respuesta en 1000 filas). Sin paginar, los períodos largos quedaban truncados
 * y daban totales incoherentes (ej. "Total" < "3 meses").
 */
async function fetchViajesMetricas(
  supabase: ReturnType<typeof createAdminClient>,
  opts: { desde: string; hasta: string; conChofer?: boolean; excluirCancelados?: boolean },
): Promise<ViajeMetricaRow[]> {
  const PAGE = 1000;
  const rows: ViajeMetricaRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios, monto_flete, moneda, tipo_cambio")
      .gte("fecha_viaje", opts.desde)
      .lte("fecha_viaje", opts.hasta);
    if (opts.conChofer) q = q.not("chofer_id", "is", null);
    if (opts.excluirCancelados) q = q.neq("estado", "cancelado");
    const { data } = await q.order("id").range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    rows.push(...(data as ViajeMetricaRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

export type TotalesPeriodo = {
  viajes: number;
  choferesActivos: number;
  kmConCarga: number;
  kmVacios: number;
  facturacion: number;
};

/**
 * Totales del período sobre TODOS los viajes no cancelados — misma definición que
 * el "Total viajes" de la página de Viajes, para que el dashboard coincida con esa
 * vista. A diferencia del ranking (solo choferes propios activos), acá entran
 * también egresados, fleteros y viajes sin chofer asignado.
 */
export async function computeTotalesPeriodo(desde: string, hasta: string): Promise<TotalesPeriodo> {
  const supabase = createAdminClient();
  const rows = await fetchViajesMetricas(supabase, { desde, hasta, excluirCancelados: true });
  let kmConCarga = 0;
  let kmVacios = 0;
  let facturacion = 0;
  const choferes = new Set<string>();
  for (const v of rows) {
    kmConCarga += v.km_con_carga ?? 0;
    kmVacios += v.km_vacios ?? 0;
    const m = v.monto_flete ?? 0;
    if (m) facturacion += v.moneda && v.moneda !== "ARS" && v.tipo_cambio ? m * v.tipo_cambio : m;
    if (v.chofer_id) choferes.add(v.chofer_id);
  }
  return { viajes: rows.length, choferesActivos: choferes.size, kmConCarga, kmVacios, facturacion };
}

export async function computeRanking({
  desde,
  hasta,
  criterios,
}: {
  desde: string;
  hasta: string;
  criterios?: RankingCriterios;
}): Promise<RankingChofer[]> {
  const supabase = createAdminClient();
  const p = criterios ?? (await getRankingCriterios());

  const [
    { data: choferes },
    { data: viajes },
    { data: apercibimientos },
    { data: roturas },
    { data: licencias },
    { data: siniestros },
    { data: ausenciasInjust },
    { data: camionActuales },
    { data: historial },
    { data: asignacionDiaria },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, localidad")
      .eq("estado", "activo")
      // Los fleteros tercerizados no entran al ranking de choferes propios
      .or("rol.is.null,rol.neq.fletero")
      .order("apellido"),

    // Paginado (PostgREST corta en 1000) para no truncar períodos largos.
    (async () => ({
      data: await fetchViajesMetricas(supabase, { desde, hasta, conChofer: true }),
    }))(),

    supabase
      .from("chofer_apercibimientos")
      .select("chofer_id")
      .gte("fecha", desde)
      .lte("fecha", hasta),

    supabase
      .from("roturas_gomas")
      .select("chofer_id")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .not("chofer_id", "is", null),

    supabase
      .from("chofer_licencias_medicas")
      .select("chofer_id")
      .lte("fecha_desde", hasta)
      .or(`fecha_hasta.is.null,fecha_hasta.gte.${desde}`),

    // Siniestros / accidentes del período (cada uno pesa fuerte en el score).
    supabase
      .from("siniestros")
      .select("chofer_id")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .not("chofer_id", "is", null),

    // Ausencias INJUSTIFICADAS del período: no vacaciones, no canceladas y
    // marcadas justificada=false. Cada una resta puntos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("chofer_id")
      .eq("es_vacaciones", false)
      .eq("justificada", false)
      .is("deleted_at", null)
      .gte("fecha_inicio", desde)
      .lte("fecha_inicio", hasta),

    // Camión asignado actualmente a cada chofer.
    supabase
      .from("camiones")
      .select("id, chofer_actual_id")
      .not("chofer_actual_id", "is", null),

    // Historial de camiones que solape el período (para contar visitas al taller).
    supabase
      .from("chofer_camion_historial")
      .select("chofer_id, camion_id, desde, hasta"),

    // Asignación diaria (reemplazos puntuales chofer↔camión) dentro del período:
    // un chofer que tomó otra unidad por un día también "manejó" ese camión.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id")
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  // Mapa chofer → camiones que manejó en el período (actual + historial que solapa).
  const camionesPorChofer = new Map<string, Set<string>>();
  const add = (choferId: string | null, camionId: string | null) => {
    if (!choferId || !camionId) return;
    if (!camionesPorChofer.has(choferId)) camionesPorChofer.set(choferId, new Set());
    camionesPorChofer.get(choferId)!.add(camionId);
  };
  for (const c of camionActuales ?? []) add(c.chofer_actual_id, c.id);
  for (const h of historial ?? []) {
    const solapa = h.desde <= hasta && (!h.hasta || h.hasta >= desde);
    if (solapa) add(h.chofer_id, h.camion_id);
  }
  // La asignación diaria ya viene filtrada por fecha dentro del período.
  for (const a of (asignacionDiaria ?? []) as { chofer_id: string; camion_id: string }[]) {
    add(a.chofer_id, a.camion_id);
  }

  // Visitas al taller (reparación/avería + gomería) por camión en el período.
  const todosCamionIds = [...new Set([...camionesPorChofer.values()].flatMap((s) => [...s]))];
  const tallerPorCamion = new Map<string, number>();
  if (todosCamionIds.length > 0) {
    const { data: mantenimientos } = await supabase
      .from("mantenimientos")
      .select("camion_id, tipo, tipo_servicio:tipos_servicio(codigo)")
      .in("camion_id", todosCamionIds)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    const TALLER_CODIGOS = new Set(["reparacion", "gomeria"]);
    for (const m of mantenimientos ?? []) {
      const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
      const codigo = (ts as { codigo?: string } | null)?.codigo;
      const esTaller = codigo ? TALLER_CODIGOS.has(codigo) : m.tipo === "reparacion";
      if (esTaller && m.camion_id) {
        tallerPorCamion.set(m.camion_id, (tallerPorCamion.get(m.camion_id) ?? 0) + 1);
      }
    }
  }

  const ranking: RankingChofer[] = (choferes ?? []).map((c) => {
    const cv = (viajes ?? []).filter((v) => v.chofer_id === c.id);
    const ca = (apercibimientos ?? []).filter((a) => a.chofer_id === c.id);
    const cr = (roturas ?? []).filter((r) => r.chofer_id === c.id);
    const cl = (licencias ?? []).filter((l) => l.chofer_id === c.id);
    const cs = (siniestros ?? []).filter((s) => s.chofer_id === c.id);
    const cai = ((ausenciasInjust ?? []) as { chofer_id: string }[]).filter((a) => a.chofer_id === c.id);

    const km_con_carga = cv.reduce((s, v) => s + (v.km_con_carga ?? 0), 0);
    const km_vacios = cv.reduce((s, v) => s + (v.km_vacios ?? 0), 0);
    const km_total = km_con_carga + km_vacios;
    const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;

    // Facturación del período, normalizada a ARS (convierte si la moneda no es ARS
    // y hay tipo de cambio cargado). monto_flete puede venir nulo.
    const facturacion_total = cv.reduce((s, v) => {
      const m = v.monto_flete ?? 0;
      if (!m) return s;
      const enArs = v.moneda && v.moneda !== "ARS" && v.tipo_cambio ? m * v.tipo_cambio : m;
      return s + enArs;
    }, 0);
    const pesos_por_km = km_total > 0 && facturacion_total > 0 ? facturacion_total / km_total : null;

    const apercibimientos_count = ca.length;
    const roturas_count = cr.length;
    const siniestros_count = cs.length;
    const ausencias_injustificadas_count = cai.length;
    const licencias_activas = cl.length;

    // Visitas al taller de todos los camiones que manejó el chofer en el período.
    let taller_count = 0;
    const camsChofer = camionesPorChofer.get(c.id);
    if (camsChofer) {
      for (const camId of camsChofer) taller_count += tallerPorCamion.get(camId) ?? 0;
    }

    let score: number | null = null;
    let desglose: ScoreDesglose[] = [];
    if (cv.length > 0) {
      const res = calcularScore(
        {
          pct_vacios,
          apercibimientos: apercibimientos_count,
          roturas: roturas_count,
          siniestros: siniestros_count,
          ausencias_injust: ausencias_injustificadas_count,
          taller: taller_count,
          licencias_activas,
        },
        p,
      );
      score = res.score;
      desglose = res.desglose;
    }

    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      localidad: c.localidad,
      viajes_count: cv.length,
      km_con_carga,
      km_vacios,
      km_total,
      pct_vacios,
      apercibimientos_count,
      roturas_count,
      taller_count,
      siniestros_count,
      ausencias_injustificadas_count,
      licencias_activas,
      facturacion_total,
      pesos_por_km,
      score,
      desglose,
    };
  });

  ranking.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  return ranking;
}

/** Score + desglose de UN solo chofer en un período (queries acotadas a ese
 * chofer). Lo usa el header del legajo. Devuelve null si no tuvo viajes. */
export async function computeScoreChofer(
  choferId: string,
  desde: string,
  hasta: string,
): Promise<{ score: number; desglose: ScoreDesglose[]; viajes_count: number } | null> {
  const supabase = createAdminClient();
  const p = await getRankingCriterios();

  const [
    { data: viajes },
    { data: apercibimientos },
    { data: roturas },
    { data: licencias },
    { data: siniestros },
    { data: ausenciasInjust },
    { data: camionActuales },
    { data: historial },
    { data: asignacionDiaria },
  ] = await Promise.all([
    supabase.from("viajes").select("km_con_carga, km_vacios").eq("chofer_id", choferId).gte("fecha_viaje", desde).lte("fecha_viaje", hasta),
    supabase.from("chofer_apercibimientos").select("id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
    supabase.from("roturas_gomas").select("id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
    supabase.from("chofer_licencias_medicas").select("id").eq("chofer_id", choferId).lte("fecha_desde", hasta).or(`fecha_hasta.is.null,fecha_hasta.gte.${desde}`),
    supabase.from("siniestros").select("id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("chofer_ausencias").select("id").eq("chofer_id", choferId).eq("es_vacaciones", false).eq("justificada", false).is("deleted_at", null).gte("fecha_inicio", desde).lte("fecha_inicio", hasta),
    supabase.from("camiones").select("id").eq("chofer_actual_id", choferId),
    supabase.from("chofer_camion_historial").select("camion_id, desde, hasta").eq("chofer_id", choferId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("asignacion_diaria").select("camion_id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
  ]);

  if (!viajes || viajes.length === 0) return null;

  const km_con_carga = viajes.reduce((s, v) => s + (v.km_con_carga ?? 0), 0);
  const km_vacios = viajes.reduce((s, v) => s + (v.km_vacios ?? 0), 0);
  const km_total = km_con_carga + km_vacios;
  const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;

  const camIds = new Set<string>();
  for (const c of camionActuales ?? []) camIds.add(c.id);
  for (const h of (historial ?? []) as { camion_id: string; desde: string; hasta: string | null }[]) {
    if (h.desde <= hasta && (!h.hasta || h.hasta >= desde)) camIds.add(h.camion_id);
  }
  for (const a of (asignacionDiaria ?? []) as { camion_id: string }[]) camIds.add(a.camion_id);

  let taller = 0;
  if (camIds.size > 0) {
    const { data: mant } = await supabase
      .from("mantenimientos")
      .select("tipo, tipo_servicio:tipos_servicio(codigo)")
      .in("camion_id", [...camIds])
      .gte("fecha", desde)
      .lte("fecha", hasta);
    const TALLER = new Set(["reparacion", "gomeria"]);
    for (const m of mant ?? []) {
      const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
      const codigo = (ts as { codigo?: string } | null)?.codigo;
      if (codigo ? TALLER.has(codigo) : m.tipo === "reparacion") taller += 1;
    }
  }

  const { score, desglose } = calcularScore(
    {
      pct_vacios,
      apercibimientos: (apercibimientos ?? []).length,
      roturas: (roturas ?? []).length,
      siniestros: (siniestros ?? []).length,
      ausencias_injust: (ausenciasInjust ?? []).length,
      taller,
      licencias_activas: (licencias ?? []).length,
    },
    p,
  );

  return { score, desglose, viajes_count: viajes.length };
}

export type RangoKey = "1m" | "3m" | "1y" | "total" | "custom";

export type RangoResuelto = {
  rango: RangoKey;
  desde: string;
  hasta: string;
  label: string;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMes(d: Date): string {
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function formatMesAnioCompleto(d: Date): string {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function formatFecha(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const VALID_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function resolverRango(params: {
  rango?: string;
  desde?: string;
  hasta?: string;
}): RangoResuelto {
  const now = new Date();
  const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1);
  const finMesActual = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // Default: últimos 3 meses. El "mes actual" suele tener pocos viajes (recién
  // empieza) y daba la falsa impresión de que todos estaban en 100.
  const rango = (params.rango ?? "3m") as RangoKey;

  if (rango === "custom") {
    const { desde, hasta } = params;
    if (
      desde &&
      hasta &&
      VALID_ISO.test(desde) &&
      VALID_ISO.test(hasta) &&
      desde <= hasta
    ) {
      return {
        rango: "custom",
        desde,
        hasta,
        label: `${formatFecha(desde)} – ${formatFecha(hasta)}`,
      };
    }
    // si "custom" viene mal o sin fechas, caemos al mes actual
  }

  if (rango === "3m") {
    const desde = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      rango: "3m",
      desde: toISO(desde),
      hasta: toISO(finMesActual),
      label: `Últimos 3 meses · ${formatMes(desde)} – ${formatMes(finMesActual)}`,
    };
  }

  if (rango === "1y") {
    const desde = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      rango: "1y",
      desde: toISO(desde),
      hasta: toISO(finMesActual),
      label: `Último año · ${formatMes(desde)} – ${formatMes(finMesActual)}`,
    };
  }

  if (rango === "total") {
    // Histórico completo: rango amplio que abarca todos los viajes cargados.
    return {
      rango: "total",
      desde: "1900-01-01",
      hasta: "2999-12-31",
      label: "Histórico completo",
    };
  }

  return {
    rango: "1m",
    desde: toISO(inicioMesActual),
    hasta: toISO(finMesActual),
    label: formatMesAnioCompleto(inicioMesActual),
  };
}
