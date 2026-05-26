"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;
const DELTA_KM_MAX_RAZONABLE = 5000; // descarta deltas absurdos (resets de odómetro, datos cargados mal)
const DELTA_KM_MIN = 1;

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

export async function getStatsMesAction(): Promise<StatsMes> {
  const supabase = createAdminClient();
  const desde = primerDiaDelMes();

  const { data } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, camion_id, chofer_id")
    .gte("fecha", desde)
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
  let litrosUsados = 0;
  let kmRecorridos = 0;

  const porCamion = new Map<string, typeof cargas>();
  for (const c of cargas) {
    if (!porCamion.has(c.camion_id)) porCamion.set(c.camion_id, []);
    porCamion.get(c.camion_id)!.push(c);
  }

  for (const grupo of porCamion.values()) {
    grupo.sort((a, b) => a.km_odometro - b.km_odometro);
    for (let i = 1; i < grupo.length; i++) {
      const delta = grupo[i].km_odometro - grupo[i - 1].km_odometro;
      if (delta >= DELTA_KM_MIN && delta <= DELTA_KM_MAX_RAZONABLE) {
        litrosUsados += Number(grupo[i].litros);
        kmRecorridos += delta;
      }
    }
  }

  const eficienciaPromedio = kmRecorridos > 0 ? (litrosUsados / kmRecorridos) * 100 : null;

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

export async function getRankingEficienciaMesAction(): Promise<RankingEntry[]> {
  const supabase = createAdminClient();
  const desde = primerDiaDelMes();

  const { data } = await supabase
    .from("cargas_combustible")
    .select("id, fecha, litros, km_odometro, importe_total, camion_id, chofer_id")
    .gte("fecha", desde)
    .not("chofer_id", "is", null)
    .order("fecha", { ascending: true });

  const cargas = (data ?? []) as Pick<
    CargaRow,
    "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "camion_id" | "chofer_id"
  >[];

  if (cargas.length === 0) return [];

  // Agrupar por (chofer, camion) → calcular deltas → acumular por chofer
  type Acum = {
    cargas: number;
    litros: number;
    km: number;
    importe: number;
  };
  const acum = new Map<string, Acum>();

  const porChoferCamion = new Map<string, typeof cargas>();
  for (const c of cargas) {
    if (!c.chofer_id) continue;
    const key = `${c.chofer_id}::${c.camion_id}`;
    if (!porChoferCamion.has(key)) porChoferCamion.set(key, []);
    porChoferCamion.get(key)!.push(c);
  }

  for (const [key, grupo] of porChoferCamion.entries()) {
    const chofer_id = key.split("::")[0];
    grupo.sort((a, b) => a.km_odometro - b.km_odometro);

    const cur = acum.get(chofer_id) ?? { cargas: 0, litros: 0, km: 0, importe: 0 };
    cur.cargas += grupo.length;
    cur.importe += grupo.reduce((a, c) => a + Number(c.importe_total), 0);

    for (let i = 1; i < grupo.length; i++) {
      const delta = grupo[i].km_odometro - grupo[i - 1].km_odometro;
      if (delta >= DELTA_KM_MIN && delta <= DELTA_KM_MAX_RAZONABLE) {
        cur.litros += Number(grupo[i].litros);
        cur.km += delta;
      }
    }
    acum.set(chofer_id, cur);
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

export async function getPremioDelMesAction(): Promise<PremioMes> {
  const ranking = await getRankingEficienciaMesAction();
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
};

export type GetCargasParams = {
  page?: number;
  choferId?: string;
  camionId?: string;
};

export async function getCargasAction(
  params: GetCargasParams = {}
): Promise<{ data: CargaRowUI[]; hasMore: boolean; count: number }> {
  const { page = 0, choferId, camionId } = params;
  const supabase = createAdminClient();
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("cargas_combustible")
    .select(
      "id, fecha, litros, km_odometro, importe_total, estacion, chofer_id, camion_id",
      { count: "exact" }
    )
    .order("fecha", { ascending: false })
    .range(from, to);

  if (choferId) query = query.eq("chofer_id", choferId);
  if (camionId) query = query.eq("camion_id", camionId);

  const { data, count } = await query;
  const rows = (data ?? []) as Pick<
    CargaRow,
    "id" | "fecha" | "litros" | "km_odometro" | "importe_total" | "estacion" | "chofer_id" | "camion_id"
  >[];

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
    };
  });

  return {
    data: mapped,
    hasMore: (count ?? 0) > (page + 1) * PAGE_SIZE,
    count: count ?? 0,
  };
}
