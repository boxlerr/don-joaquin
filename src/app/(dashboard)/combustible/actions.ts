"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { calcularEficienciaPorDeltas } from "@/lib/combustible-eficiencia";

const PAGE_SIZE = 25;

type CargaRow = {
  id: string;
  fecha: string;
  litros: number;
  km_odometro: number;
  importe_total: number;
  estacion: string | null;
  observaciones: string | null;
  camion_id: string;
  chofer_id: string | null;
};

type ChoferMap = Map<string, { nombre: string; apellido: string }>;
type CamionMap = Map<string, { patente: string; marca: string | null; modelo: string | null }>;

function primerDiaDelMes(): string {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
}

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${r}`;
}

function getRangoMes(monthStr?: string): { desde: string; hasta: string } {
  let year: number;
  let month: number;

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed
  } else {
    const hoy = new Date();
    year = hoy.getFullYear();
    month = hoy.getMonth();
  }

  const desde = new Date(year, month, 1);
  const hasta = new Date(year, month + 1, 0); // último día del mes

  return {
    desde: formatDateYYYYMMDD(desde),
    hasta: formatDateYYYYMMDD(hasta),
  };
}

async function fetchMaps(
  supabase: ReturnType<typeof createAdminClient>,
  choferIds: string[],
  camionIds: string[],
): Promise<{ choferes: ChoferMap; camiones: CamionMap }> {
  const [choferesRes, camionesRes] = await Promise.all([
    choferIds.length
      ? supabase.from("choferes").select("id, nombre, apellido").in("id", choferIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; apellido: string }[] }),
    camionIds.length
      ? supabase.from("camiones").select("id, patente, marca, modelo").in("id", camionIds)
      : Promise.resolve({ data: [] as { id: string; patente: string; marca: string | null; modelo: string | null }[] }),
  ]);

  const choferes: ChoferMap = new Map();
  for (const c of choferesRes.data ?? []) choferes.set(c.id, { nombre: c.nombre, apellido: c.apellido });

  const camiones: CamionMap = new Map();
  for (const c of camionesRes.data ?? []) {
    camiones.set(c.id, { patente: c.patente, marca: c.marca, modelo: c.modelo });
  }

  return { choferes, camiones };
}

// ============================================================================
// Stats del mes en curso
// ============================================================================

export type StatsMes = {
  cargasTotales: number;
  litrosTotales: number;
  importeTotal: number;
  eficienciaPromedio: number | null; // L/100km global del mes
  cargasConChofer: number;
};

export async function getStatsMesAction(month?: string): Promise<StatsMes> {
  const supabase = createAdminClient();
  const { desde, hasta } = getRangoMes(month);

  const { data } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, camion_id, chofer_id")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: true });

  const cargas = (data ?? []) as Pick<
    CargaRow,
    "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "camion_id" | "chofer_id"
  >[];

  if (cargas.length === 0) {
    return { cargasTotales: 0, litrosTotales: 0, importeTotal: 0, eficienciaPromedio: null, cargasConChofer: 0 };
  }

  const litrosTotales = cargas.reduce((acc, c) => acc + Number(c.litros), 0);
  const importeTotal = cargas.reduce((acc, c) => acc + Number(c.importe_total), 0);
  const cargasConChofer = cargas.filter((c) => c.chofer_id).length;

  // Eficiencia promedio global: agrupar por camión, sumar deltas válidos
  const { eficiencia: eficienciaPromedio } = calcularEficienciaPorDeltas(
    cargas.map((c) => ({ camion_id: c.camion_id, km_odometro: c.km_odometro, litros: Number(c.litros) })),
  );

  return {
    cargasTotales: cargas.length,
    litrosTotales,
    importeTotal,
    eficienciaPromedio,
    cargasConChofer,
  };
}

// ============================================================================
// Ranking de eficiencia por chofer (mes en curso)
// ============================================================================

export type RankingEntry = {
  chofer_id: string;
  chofer: string;
  cargas: number;
  litros_totales: number;
  km_recorridos: number;
  eficiencia: number; // L/100km
  importe_total: number;
};

export async function getRankingEficienciaMesAction(month?: string): Promise<RankingEntry[]> {
  const supabase = createAdminClient();
  const { desde, hasta } = getRangoMes(month);

  const { data } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, camion_id, chofer_id")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .not("chofer_id", "is", null)
    .order("fecha", { ascending: true });

  const cargas = (data ?? []) as Pick<
    CargaRow,
    "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "camion_id" | "chofer_id"
  >[];

  if (cargas.length === 0) return [];

  // Agrupar por chofer → el helper calcula deltas agrupando por camión internamente
  type Acum = {
    cargas: number;
    litros: number;
    km: number;
    importe: number;
  };
  const acum = new Map<string, Acum>();

  const porChofer = new Map<string, typeof cargas>();
  for (const c of cargas) {
    if (!c.chofer_id) continue;
    if (!porChofer.has(c.chofer_id)) porChofer.set(c.chofer_id, []);
    porChofer.get(c.chofer_id)!.push(c);
  }

  for (const [chofer_id, grupo] of porChofer.entries()) {
    const { litrosUsados, kmRecorridos } = calcularEficienciaPorDeltas(
      grupo.map((c) => ({ camion_id: c.camion_id, km_odometro: c.km_odometro, litros: Number(c.litros) })),
    );
    acum.set(chofer_id, {
      cargas: grupo.length,
      litros: litrosUsados,
      km: kmRecorridos,
      importe: grupo.reduce((a, c) => a + Number(c.importe_total), 0),
    });
  }

  const choferIds = Array.from(acum.keys());
  const { choferes } = await fetchMaps(supabase, choferIds, []);

  const ranking: RankingEntry[] = [];
  for (const [chofer_id, a] of acum.entries()) {
    if (a.km <= 0) continue; // sin datos suficientes para calcular eficiencia
    const c = choferes.get(chofer_id);
    ranking.push({
      chofer_id,
      chofer: c ? `${c.apellido}, ${c.nombre}` : "—",
      cargas: a.cargas,
      litros_totales: a.litros,
      km_recorridos: a.km,
      eficiencia: (a.litros / a.km) * 100,
      importe_total: a.importe,
    });
  }

  ranking.sort((x, y) => x.eficiencia - y.eficiencia); // menor L/100km = más eficiente
  return ranking;
}

// ============================================================================
// Premio del mes (chofer más eficiente con mínimo razonable de cargas)
// ============================================================================

export type PremioMes = {
  chofer: string;
  eficiencia: number;
  km_recorridos: number;
  litros_totales: number;
  cargas: number;
} | null;

const MIN_CARGAS_PARA_PREMIO = 2;

export async function getPremioDelMesAction(month?: string): Promise<PremioMes> {
  const ranking = await getRankingEficienciaMesAction(month);
  const elegibles = ranking.filter((r) => r.cargas >= MIN_CARGAS_PARA_PREMIO);
  if (elegibles.length === 0) return null;
  const ganador = elegibles[0];
  return {
    chofer: ganador.chofer,
    eficiencia: ganador.eficiencia,
    km_recorridos: ganador.km_recorridos,
    litros_totales: ganador.litros_totales,
    cargas: ganador.cargas,
  };
}

// ============================================================================
// Listado de cargas (paginado)
// ============================================================================

export type CargaRowUI = {
  id: string;
  fecha: string;
  camion_patente: string;
  camion_marca_modelo: string;
  chofer: string | null;
  litros: number;
  km_odometro: number;
  importe_total: number;
  estacion: string | null;
  lugar_carga: string | null;
  chofer_id: string | null;
  observaciones: string | null;
};

export type GetCargasParams = {
  page?: number;
  choferId?: string;
  camionId?: string;
  sortBy?: string;
  month?: string;
};

export async function getCargasAction(
  params: GetCargasParams = {}
): Promise<{ data: CargaRowUI[]; hasMore: boolean; count: number }> {
  const { page = 0, choferId, camionId, sortBy = "fecha_desc", month } = params;
  const supabase = createAdminClient();
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("cargas_combustible")
    .select(
      "id, fecha, litros, km_odometro, importe_total, estacion, lugar_carga, observaciones, chofer_id, camion_id",
      { count: "exact" }
    );

  if (choferId) query = query.eq("chofer_id", choferId);
  if (camionId) query = query.eq("camion_id", camionId);
  if (month) {
    const { desde, hasta } = getRangoMes(month);
    query = query.gte("fecha", desde).lte("fecha", hasta);
  }

  // Aplicar ordenamiento dinámico
  switch (sortBy) {
    case "fecha_asc":
      query = query.order("fecha", { ascending: true });
      break;
    case "litros_desc":
      query = query.order("litros", { ascending: false });
      break;
    case "litros_asc":
      query = query.order("litros", { ascending: true });
      break;
    case "importe_desc":
      query = query.order("importe_total", { ascending: false });
      break;
    case "importe_asc":
      query = query.order("importe_total", { ascending: true });
      break;
    case "km_desc":
      query = query.order("km_odometro", { ascending: false });
      break;
    case "km_asc":
      query = query.order("km_odometro", { ascending: true });
      break;
    case "fecha_desc":
    default:
      query = query.order("fecha", { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data, count } = await query;
  const rows = (data ?? []) as (Pick<
    CargaRow,
    "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "estacion" | "observaciones" | "chofer_id" | "camion_id"
  > & { lugar_carga: string | null })[];

  const choferIds = [...new Set(rows.map((r) => r.chofer_id).filter(Boolean) as string[])];
  const camionIds = [...new Set(rows.map((r) => r.camion_id))];
  const { choferes, camiones } = await fetchMaps(supabase, choferIds, camionIds);

  const mapped: CargaRowUI[] = rows.map((r) => {
    const camion = camiones.get(r.camion_id);
    const chofer = r.chofer_id ? choferes.get(r.chofer_id) : null;
    return {
      id: r.id,
      fecha: r.fecha,
      camion_patente: camion?.patente ?? "—",
      camion_marca_modelo: camion ? [camion.marca, camion.modelo].filter(Boolean).join(" ") : "",
      chofer: chofer ? `${chofer.apellido}, ${chofer.nombre}` : null,
      litros: Number(r.litros),
      km_odometro: r.km_odometro,
      importe_total: Number(r.importe_total),
      estacion: r.estacion,
      lugar_carga: r.lugar_carga,
      chofer_id: r.chofer_id,
      observaciones: r.observaciones,
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * PAGE_SIZE,
    count: count ?? 0,
  };
}

// ============================================================================
// Exportar cargas del período a Excel
// ============================================================================

export type CargaExport = {
  fecha: string;
  patente: string;
  marca_modelo: string;
  chofer: string;
  estacion: string;
  lugar_carga: string;
  tipo: string;
  km_odometro: number;
  litros: number;
  importe_total: number;
};

function labelLugarCarga(v: string | null): string {
  if (v === "en_ruta") return "En ruta (YPF)";
  if (v === "propia") return "Estación propia";
  return "";
}

export async function getCargasParaExportAction(month?: string): Promise<CargaExport[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, estacion, observaciones, lugar_carga, chofer_id, camion_id")
    .order("fecha", { ascending: false });

  if (month) {
    const { desde, hasta } = getRangoMes(month);
    query = query.gte("fecha", desde).lte("fecha", hasta);
  }

  const { data } = await query;
  const rows = (data ?? []) as (CargaRow & { lugar_carga: string | null })[];

  const choferIds = [...new Set(rows.map((r) => r.chofer_id).filter(Boolean) as string[])];
  const camionIds = [...new Set(rows.map((r) => r.camion_id))];
  const { choferes, camiones } = await fetchMaps(supabase, choferIds, camionIds);

  return rows.map((r) => {
    const camion = camiones.get(r.camion_id);
    const chofer = r.chofer_id ? choferes.get(r.chofer_id) : null;
    return {
      fecha: r.fecha,
      patente: camion?.patente ?? "—",
      marca_modelo: camion ? [camion.marca, camion.modelo].filter(Boolean).join(" ") : "",
      chofer: chofer ? `${chofer.apellido}, ${chofer.nombre}` : "Sin asignar",
      estacion: r.estacion ?? "",
      lugar_carga: labelLugarCarga(r.lugar_carga),
      tipo: r.observaciones?.includes("Grado 3") ? "Grado 3 (Premium)" : "Grado 2 (Común)",
      km_odometro: r.km_odometro,
      litros: Number(r.litros),
      importe_total: Number(r.importe_total),
    };
  });
}
