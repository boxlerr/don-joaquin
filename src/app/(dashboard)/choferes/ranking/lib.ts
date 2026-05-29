import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
  apercibimientos_leves: number;
  apercibimientos_moderados: number;
  apercibimientos_graves: number;
  apercibimientos_total: number;
  roturas_count: number;
  licencias_activas: number;
  score: number | null;
};

export async function computeRanking({
  desde,
  hasta,
}: {
  desde: string;
  hasta: string;
}): Promise<RankingChofer[]> {
  const supabase = createAdminClient();

  const [
    { data: choferes },
    { data: viajes },
    { data: apercibimientos },
    { data: roturas },
    { data: licencias },
  ] = await Promise.all([
    supabase
      .from("choferes")
      .select("id, nombre, apellido, localidad")
      .eq("estado", "activo")
      .order("apellido"),

    supabase
      .from("viajes")
      .select("chofer_id, km_con_carga, km_vacios")
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .not("chofer_id", "is", null),

    supabase
      .from("chofer_apercibimientos")
      .select("chofer_id, gravedad")
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
  ]);

  const ranking: RankingChofer[] = (choferes ?? []).map((c) => {
    const cv = (viajes ?? []).filter((v) => v.chofer_id === c.id);
    const ca = (apercibimientos ?? []).filter((a) => a.chofer_id === c.id);
    const cr = (roturas ?? []).filter((r) => r.chofer_id === c.id);
    const cl = (licencias ?? []).filter((l) => l.chofer_id === c.id);

    const km_con_carga = cv.reduce((s, v) => s + (v.km_con_carga ?? 0), 0);
    const km_vacios = cv.reduce((s, v) => s + (v.km_vacios ?? 0), 0);
    const km_total = km_con_carga + km_vacios;
    const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;

    const apercibimientos_graves = ca.filter((a) => a.gravedad === "grave").length;
    const apercibimientos_moderados = ca.filter((a) => a.gravedad === "moderado").length;
    const apercibimientos_leves = ca.filter((a) => a.gravedad === "leve").length;
    const roturas_count = cr.length;
    const licencias_activas = cl.length;

    let score: number | null = null;
    if (cv.length > 0) {
      let s = 100;
      if (pct_vacios > 40) s -= 20;
      else if (pct_vacios > 30) s -= 15;
      else if (pct_vacios > 20) s -= 8;
      s -= apercibimientos_graves * 15;
      s -= apercibimientos_moderados * 8;
      s -= apercibimientos_leves * 3;
      s -= roturas_count * 5;
      if (licencias_activas > 0) s -= 10;
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
      apercibimientos_leves,
      apercibimientos_moderados,
      apercibimientos_graves,
      apercibimientos_total: ca.length,
      roturas_count,
      licencias_activas,
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
