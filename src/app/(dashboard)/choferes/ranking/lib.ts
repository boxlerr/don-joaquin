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
  licencias_activas: number;
  facturacion_total: number;
  pesos_por_km: number | null;
  score: number | null;
};

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
    { data: camionActuales },
    { data: historial },
    { data: asignacionDiaria },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, localidad")
      .eq("estado", "activo")
      .order("apellido"),

    supabase
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios, monto_flete, moneda, tipo_cambio")
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .not("chofer_id", "is", null),

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
    const licencias_activas = cl.length;

    // Visitas al taller de todos los camiones que manejó el chofer en el período.
    let taller_count = 0;
    const camsChofer = camionesPorChofer.get(c.id);
    if (camsChofer) {
      for (const camId of camsChofer) taller_count += tallerPorCamion.get(camId) ?? 0;
    }

    let score: number | null = null;
    if (cv.length > 0) {
      let s = 100;
      if (pct_vacios > 40) s -= p.vacios_alto;
      else if (pct_vacios > 30) s -= p.vacios_moderado;
      else if (pct_vacios > 20) s -= p.vacios_leve;
      s -= apercibimientos_count * p.aperc;
      s -= roturas_count * p.rotura;
      s -= taller_count * p.taller;
      if (licencias_activas > 0) s -= p.licencia;
      score = Math.max(0, Math.min(100, s));
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
      licencias_activas,
      facturacion_total,
      pesos_por_km,
      score,
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

export type RangoKey = "1m" | "3m" | "1y" | "custom";

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
  const rango = (params.rango ?? "1m") as RangoKey;

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

  return {
    rango: "1m",
    desde: toISO(inicioMesActual),
    hasta: toISO(finMesActual),
    label: formatMesAnioCompleto(inicioMesActual),
  };
}
