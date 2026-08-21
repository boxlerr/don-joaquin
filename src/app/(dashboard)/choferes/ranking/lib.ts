import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularEficienciaPorDeltas, type CargaEficiencia } from "@/lib/combustible-eficiencia";
import {
  RANKING_CRITERIOS_DEFAULT,
  CONFIG_CLAVE,
  mergeCriterios,
  calcularScore,
  eventoCuentaSeguridad,
  eventoCuentaConducta,
  type RankingCriterios,
  type ScoreDesglose,
  type ConceptoResultado,
} from "./criterios";

export { RANKING_CRITERIOS_DEFAULT, calcularScore };
export type { RankingCriterios, ScoreDesglose, ConceptoResultado };

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
  /** Roturas de gomas/llantas (concepto "gomas" del score). */
  gomas_count: number;
  /** Roturas varias, sin gomas (concepto "roturas" del score). */
  roturas_varias_count: number;
  taller_count: number;
  siniestros_count: number;
  ausencias_injustificadas_count: number;
  /** Eventos de conducta del score: ausencias injustificadas + llamados/adelantos. */
  conducta_count: number;
  licencias_activas: number;
  facturacion_total: number;
  pesos_por_km: number | null;
  // Métricas nuevas del modelo de score de Bárbara (para columnas/desglose).
  km_mensual: number | null;
  toneladas_pct: number | null;
  /** Toneladas transportadas en el período (suma de tonelaje real). */
  toneladas_total: number;
  combustible_lp100: number | null;
  score: number | null;
  // Penalizaciones aplicadas (desglose "por qué" del score, compat. con la UI).
  desglose: ScoreDesglose[];
  // Detalle por concepto (base 100 − descuento por concepto).
  conceptos: ConceptoResultado[];
};

export async function getRankingCriterios(): Promise<RankingCriterios> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", CONFIG_CLAVE)
    .maybeSingle();
  let raw: unknown = undefined;
  if (data?.valor) {
    try {
      raw = JSON.parse(data.valor);
    } catch {
      raw = undefined; // JSON corrupto → caemos a defaults
    }
  }
  return mergeCriterios(raw);
}

type ViajeMetricaRow = {
  chofer_id: string | null;
  camion_id: string | null;
  fecha_viaje: string | null;
  km_con_carga: number | null;
  km_vacios: number | null;
  tonelaje_real: number | null;
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
      .select(
        "chofer_id, camion_id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real, monto_flete, moneda, tipo_cambio",
      )
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

/**
 * Un punto de la evolución del período. El período se parte SIEMPRE en la misma
 * cantidad de tramos (`SERIE_TRAMOS`), sea un mes o cinco años, así el
 * sparkline de las tarjetas del dashboard tiene la misma forma y densidad
 * cualquiera sea el rango elegido.
 */
export type PuntoSerie = {
  /** Primer día del tramo (ISO). */
  desde: string;
  /** Último día del tramo (ISO, inclusive). */
  hasta: string;
  viajes: number;
  kmConCarga: number;
  kmVacios: number;
  toneladas: number;
  facturacion: number;
};

export type TotalesPeriodo = {
  viajes: number;
  choferesActivos: number;
  kmConCarga: number;
  kmVacios: number;
  /** Toneladas transportadas (suma de tonelaje real cargado en los viajes). */
  toneladas: number;
  facturacion: number;
  /** Evolución dentro del período, para los sparklines del dashboard. */
  serie: PuntoSerie[];
  /**
   * Meses del período que tienen viajes pero NINGÚN monto cargado ("2026-07").
   *
   * Sin esto, un período de tres meses donde sólo uno tiene la facturación
   * cargada muestra el total de ese mes rotulado como si fueran los tres, y no
   * hay forma de darse cuenta desde la pantalla. Pasó con jun–ago 2026: julio y
   * agosto en $0 y el dashboard mostraba, en los hechos, junio.
   */
  mesesSinFacturacion: string[];
};

/** Cuántos tramos tiene la serie del período. 16 alcanza para que la curva se
 *  lea y es poco como para que un mes flaco quede en un serrucho de ruido. */
export const SERIE_TRAMOS = 16;

const MS_DIA = 24 * 60 * 60 * 1000;

/** Mediodía local del ISO, que es como el resto del módulo evita el corrimiento
 *  de un día que trae parsear "YYYY-MM-DD" como UTC. */
function fechaLocal(iso: string): number {
  return new Date(iso + "T12:00:00").getTime();
}

function isoDeMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Arma los tramos vacíos del período (todos del mismo ancho en días). */
function tramosDelPeriodo(desde: string, hasta: string): PuntoSerie[] {
  const ini = fechaLocal(desde);
  const fin = fechaLocal(hasta);
  const dias = Math.max(1, Math.round((fin - ini) / MS_DIA) + 1);
  const tramos = Math.min(SERIE_TRAMOS, dias);
  const out: PuntoSerie[] = [];
  for (let i = 0; i < tramos; i++) {
    const diaIni = Math.floor((i * dias) / tramos);
    const diaFin = Math.floor(((i + 1) * dias) / tramos) - 1;
    out.push({
      desde: isoDeMs(ini + diaIni * MS_DIA),
      hasta: isoDeMs(ini + Math.max(diaIni, diaFin) * MS_DIA),
      viajes: 0,
      kmConCarga: 0,
      kmVacios: 0,
      toneladas: 0,
      facturacion: 0,
    });
  }
  return out;
}

/** En qué tramo cae una fecha. -1 si queda fuera del período. */
function indiceDeTramo(fechaISO: string, desde: string, hasta: string, tramos: number): number {
  const ini = fechaLocal(desde);
  const fin = fechaLocal(hasta);
  const dias = Math.max(1, Math.round((fin - ini) / MS_DIA) + 1);
  const dia = Math.round((fechaLocal(fechaISO) - ini) / MS_DIA);
  if (dia < 0 || dia >= dias) return -1;
  return Math.min(tramos - 1, Math.floor((dia * tramos) / dias));
}

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
  let toneladas = 0;
  let facturacion = 0;
  const choferes = new Set<string>();
  // Facturación por mes, para poder avisar cuáles quedaron sin cargar.
  const porMes = new Map<string, number>();
  // Misma pasada que los totales: la serie sale de las filas que ya trajimos,
  // sin una segunda consulta.
  const serie = tramosDelPeriodo(desde, hasta);
  for (const v of rows) {
    const km = v.km_con_carga ?? 0;
    const kmV = v.km_vacios ?? 0;
    const tn = v.tonelaje_real ?? 0;
    const m = v.monto_flete ?? 0;
    const monto = m ? (v.moneda && v.moneda !== "ARS" && v.tipo_cambio ? m * v.tipo_cambio : m) : 0;
    kmConCarga += km;
    kmVacios += kmV;
    toneladas += tn;
    facturacion += monto;
    if (v.fecha_viaje) {
      const mes = v.fecha_viaje.slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + monto);
    }
    if (v.chofer_id) choferes.add(v.chofer_id);
    if (v.fecha_viaje) {
      const i = indiceDeTramo(v.fecha_viaje, desde, hasta, serie.length);
      if (i >= 0) {
        serie[i].viajes++;
        serie[i].kmConCarga += km;
        serie[i].kmVacios += kmV;
        serie[i].toneladas += tn;
        serie[i].facturacion += monto;
      }
    }
  }
  // Los tramos que todavía no empezaron se descartan. Si no, un período que
  // llega a fin de mes (el "últimos 3 meses" default llega al 31) dibuja media
  // curva pegada al cero y parece un desplome de la operación, cuando en
  // realidad son días que no ocurrieron.
  const hoyISO = isoDeMs(Date.now());
  const serieHastaHoy = serie.filter((t) => t.desde <= hoyISO);

  // Sólo se nombran los meses que TIENEN viajes: un mes sin ningún viaje
  // cargado no es "sin facturación", es un mes que todavía no existe.
  const mesesSinFacturacion = [...porMes.entries()]
    .filter(([, monto]) => monto === 0)
    .map(([mes]) => mes)
    .sort();

  return {
    viajes: rows.length,
    choferesActivos: choferes.size,
    kmConCarga,
    kmVacios,
    toneladas,
    facturacion,
    mesesSinFacturacion,
    // Con un solo tramo no hay curva que dibujar; se deja la serie completa
    // antes que dejar la tarjeta sin sparkline.
    serie: serieHastaHoy.length >= 2 ? serieHastaHoy : serie,
  };
}

// Tipos de rotura que cuentan como "gomas" (concepto 4); el resto va a
// "roturas varias" (concepto 5). La tabla roturas_gomas hoy guarda también
// daños generales (guardabarros, carrocería, mecánica, etc.).
const GOMA_TIPOS = new Set(["goma", "llanta", "cubierta", "neumatico", "neumático"]);
function esGoma(tipo: string | null): boolean {
  if (!tipo) return true; // sin tipo en la tabla de gomas → se asume goma
  return GOMA_TIPOS.has(tipo.trim().toLowerCase());
}

type CargaComb = { camion_id: string | null; litros: number | null; km_odometro: number | null };

/**
 * L/100km por camión, método tanque-a-tanque: entre la primera y la última
 * carga del período, litros consumidos / km recorridos × 100. Necesita ≥2
 * cargas con odómetro. Descarta valores no realistas (odómetro mal cargado).
 */
function lp100PorCamion(cargas: CargaComb[]): Map<string, number> {
  const porCamion = new Map<string, { km: number; litros: number }[]>();
  for (const c of cargas) {
    if (!c.camion_id || !c.km_odometro || c.km_odometro <= 0 || !c.litros || c.litros <= 0) continue;
    if (!porCamion.has(c.camion_id)) porCamion.set(c.camion_id, []);
    porCamion.get(c.camion_id)!.push({ km: c.km_odometro, litros: c.litros });
  }
  const out = new Map<string, number>();
  const MAX_TRAMO_KM = 3000; // un tanque rinde ~1.500–2.500 km; un salto mayor = lectura mala u omitida
  for (const [camion, arr] of porCamion) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.km - b.km);
    // Tanque-a-tanque por TRAMOS consecutivos válidos: así una sola lectura de
    // odómetro mal cargada (salto imposible) no contamina todo el cálculo del
    // camión; se descartan solo los tramos absurdos y se promedian los buenos.
    let kmTotal = 0;
    let litrosTotal = 0;
    for (let i = 1; i < arr.length; i++) {
      const dkm = arr[i].km - arr[i - 1].km;
      if (dkm > 0 && dkm <= MAX_TRAMO_KM) {
        kmTotal += dkm;
        litrosTotal += arr[i].litros; // el llenado i repone lo consumido en el tramo
      }
    }
    if (kmTotal < 200) continue; // muy poco recorrido medido → no es representativo
    const lp100 = (litrosTotal / kmTotal) * 100;
    if (lp100 >= 15 && lp100 <= 120) out.set(camion, lp100); // filtro de sanidad
  }
  return out;
}

function mesesActivos(fechas: (string | null)[]): number {
  const set = new Set<string>();
  for (const f of fechas) if (f) set.add(f.slice(0, 7)); // YYYY-MM
  return Math.max(1, set.size);
}

/**
 * Resuelve la referencia efectiva de consumo (concepto combustible). En modo
 * "flota_mes_anterior" (idea de Bárbara: comparar contra cómo vino la flota y
 * no contra un número fijo) la referencia pasa a ser el promedio de TODAS las
 * cargas de la flota en el mes calendario ANTERIOR al mes de `hasta`, con la
 * misma lógica tanque-a-tanque del módulo /combustible. Si ese mes no tiene
 * datos suficientes, se cae a la referencia fija ("si complica, queda el fijo").
 * En modo "fijo" devuelve la config tal cual, sin tocar la DB.
 */
async function conRefCombustibleEfectiva(
  supabase: ReturnType<typeof createAdminClient>,
  p: RankingCriterios,
  hastaISO: string,
): Promise<RankingCriterios> {
  if (p.combustible_ref_modo !== "flota_mes_anterior") return p;

  // Mes calendario anterior al mes de `hasta` (fechas ISO yyyy-mm-dd).
  const y = Number(hastaISO.slice(0, 4));
  const m = Number(hastaISO.slice(5, 7)); // 1..12
  const desde = toISO(new Date(y, m - 2, 1));
  const hasta = toISO(new Date(y, m - 1, 0)); // día 0 = último día del mes anterior

  // Cargas de toda la flota en ese mes (sin filtrar por chofer ni camión).
  const { data } = await supabase
    .from("cargas_combustible")
    .select("camion_id, litros, km_odometro")
    .gte("fecha", desde)
    .lte("fecha", `${hasta}T23:59:59`);

  const cargas: CargaEficiencia[] = [];
  for (const c of (data ?? []) as CargaComb[]) {
    if (!c.camion_id || !c.litros || c.litros <= 0 || !c.km_odometro || c.km_odometro <= 0) continue;
    cargas.push({ camion_id: c.camion_id, litros: c.litros, km_odometro: c.km_odometro });
  }
  const { eficiencia } = calcularEficienciaPorDeltas(cargas);
  if (eficiencia == null) return p; // sin dato del mes anterior → respaldo fijo

  return { ...p, combustible_ref: eficiencia };
}

/**
 * Apercibimientos del período con su `tipo`, tolerando que la columna aún no exista
 * en remoto (migración `20260630_apercibimientos_tipo.sql` sin aplicar): si el select
 * con `tipo` falla, reintenta sin él y los trata como apercibimiento (comportamiento
 * previo — no se pierde la penalización de Seguridad).
 */
async function fetchApercibimientosTipo(
  supabase: ReturnType<typeof createAdminClient>,
  opts: { desde: string; hasta: string; choferId?: string },
): Promise<{ chofer_id: string; tipo: string | null }[]> {
  const build = (cols: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("chofer_apercibimientos")
      .select(cols)
      .gte("fecha", opts.desde)
      .lte("fecha", opts.hasta);
    if (opts.choferId) q = q.eq("chofer_id", opts.choferId);
    return q;
  };
  const conTipo = await build("chofer_id, tipo");
  if (!conTipo.error) return (conTipo.data ?? []) as { chofer_id: string; tipo: string | null }[];
  const sinTipo = await build("chofer_id");
  return ((sinTipo.data ?? []) as { chofer_id: string }[]).map((a) => ({ chofer_id: a.chofer_id, tipo: null }));
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
  // Con el modo dinámico activado, la referencia de consumo pasa a ser el
  // promedio de la flota del mes anterior (misma para todos los choferes).
  const pScore = await conRefCombustibleEfectiva(supabase, p, hasta);

  const [
    { data: choferes },
    { data: viajes },
    { data: roturas },
    { data: licencias },
    { data: siniestros },
    { data: ausenciasInjust },
    { data: camiones },
    { data: historial },
    { data: asignacionDiaria },
    { data: cargasComb },
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
      .from("roturas_gomas")
      // gravedad: la usa el cómputo de "roturas graves" del score (sin esta
      // columna, varias_graves quedaba siempre en 0).
      .select("chofer_id, tipo, gravedad")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .not("chofer_id", "is", null),

    supabase
      .from("chofer_licencias_medicas")
      .select("chofer_id")
      .lte("fecha_desde", hasta)
      .or(`fecha_hasta.is.null,fecha_hasta.gte.${desde}`),

    supabase
      .from("siniestros")
      .select("chofer_id")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .not("chofer_id", "is", null),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("chofer_ausencias")
      .select("chofer_id")
      .eq("es_vacaciones", false)
      .eq("justificada", false)
      .is("deleted_at", null)
      .gte("fecha_inicio", desde)
      .lte("fecha_inicio", hasta),

    // Todos los camiones (con capacidad) — para asignación actual y capacidad nominal.
    supabase.from("camiones").select("id, chofer_actual_id, capacidad_tn"),

    supabase.from("chofer_camion_historial").select("chofer_id, camion_id, desde, hasta"),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("asignacion_diaria")
      .select("chofer_id, camion_id")
      .gte("fecha", desde)
      .lte("fecha", hasta),

    // Cargas de combustible del período (para L/100km por camión).
    supabase
      .from("cargas_combustible")
      .select("camion_id, litros, km_odometro")
      .gte("fecha", desde)
      .lte("fecha", `${hasta}T23:59:59`),
  ]);

  // Apercibimientos/sanciones del período (resiliente a la migración de `tipo`).
  const apercibimientos = await fetchApercibimientosTipo(supabase, { desde, hasta });

  // Mapa chofer → camiones que manejó en el período (actual + historial que solapa).
  const camionesPorChofer = new Map<string, Set<string>>();
  const capacidadPorCamion = new Map<string, number>();
  const add = (choferId: string | null, camionId: string | null) => {
    if (!choferId || !camionId) return;
    if (!camionesPorChofer.has(choferId)) camionesPorChofer.set(choferId, new Set());
    camionesPorChofer.get(choferId)!.add(camionId);
  };
  for (const c of (camiones ?? []) as { id: string; chofer_actual_id: string | null; capacidad_tn: number | null }[]) {
    if (c.capacidad_tn && c.capacidad_tn > 0) capacidadPorCamion.set(c.id, c.capacidad_tn);
    add(c.chofer_actual_id, c.id);
  }
  for (const h of historial ?? []) {
    const solapa = h.desde <= hasta && (!h.hasta || h.hasta >= desde);
    if (solapa) add(h.chofer_id, h.camion_id);
  }
  for (const a of (asignacionDiaria ?? []) as { chofer_id: string; camion_id: string }[]) {
    add(a.chofer_id, a.camion_id);
  }

  const lp100Camion = lp100PorCamion((cargasComb ?? []) as CargaComb[]);

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

  // Pre-agrupar por chofer UNA sola vez (O(n+m)) en vez de filtrar cada colección
  // entera por cada chofer (O(n·m)) — esto corre en cada carga del dashboard/ranking.
  const groupByChofer = <T extends { chofer_id: string | null }>(arr: T[] | null | undefined) => {
    const m = new Map<string, T[]>();
    for (const x of arr ?? []) {
      if (!x.chofer_id) continue;
      const list = m.get(x.chofer_id);
      if (list) list.push(x);
      else m.set(x.chofer_id, [x]);
    }
    return m;
  };
  const viajesPorChofer = groupByChofer(viajes);
  const apercPorChofer = groupByChofer(apercibimientos);
  const roturasPorChofer = groupByChofer(
    (roturas ?? []) as { chofer_id: string; tipo: string | null; gravedad: string | null }[],
  );
  const licenciasPorChofer = groupByChofer(licencias);
  const siniestrosPorChofer = groupByChofer(siniestros);
  const ausenciasPorChofer = groupByChofer((ausenciasInjust ?? []) as { chofer_id: string }[]);

  const ranking: RankingChofer[] = (choferes ?? []).map((c) => {
    const cv = viajesPorChofer.get(c.id) ?? [];
    const ca = apercPorChofer.get(c.id) ?? [];
    const seguridad_eventos = ca.filter((a) => eventoCuentaSeguridad(a.tipo)).length;
    const conducta_eventos = ca.filter((a) => eventoCuentaConducta(a.tipo)).length;
    const cr = roturasPorChofer.get(c.id) ?? [];
    const cl = licenciasPorChofer.get(c.id) ?? [];
    const cs = siniestrosPorChofer.get(c.id) ?? [];
    const cai = ausenciasPorChofer.get(c.id) ?? [];

    const km_con_carga = cv.reduce((s, v) => s + (v.km_con_carga ?? 0), 0);
    const km_vacios = cv.reduce((s, v) => s + (v.km_vacios ?? 0), 0);
    const km_total = km_con_carga + km_vacios;
    const pct_vacios = km_total > 0 ? (km_vacios / km_total) * 100 : 0;

    const facturacion_total = cv.reduce((s, v) => {
      const m = v.monto_flete ?? 0;
      if (!m) return s;
      const enArs = v.moneda && v.moneda !== "ARS" && v.tipo_cambio ? m * v.tipo_cambio : m;
      return s + enArs;
    }, 0);
    const pesos_por_km = km_total > 0 && facturacion_total > 0 ? facturacion_total / km_total : null;

    // Roturas: separar gomas de roturas varias por tipo, y las varias por gravedad.
    const gomas_count = cr.filter((r) => esGoma(r.tipo)).length;
    const varias = cr.filter((r) => !esGoma(r.tipo));
    const varias_graves = varias.filter((r) => r.gravedad === "grave").length;
    const varias_leves = varias.length - varias_graves;

    const apercibimientos_count = seguridad_eventos; // Seguridad = apercibimientos + multas
    const roturas_count = cr.length;
    const siniestros_count = cs.length;
    const ausencias_injustificadas_count = cai.length;
    const licencias_activas = cl.length;

    // Visitas al taller de todos los camiones que manejó el chofer.
    let taller_count = 0;
    const camsChofer = camionesPorChofer.get(c.id);
    if (camsChofer) for (const camId of camsChofer) taller_count += tallerPorCamion.get(camId) ?? 0;

    const meses = mesesActivos(cv.map((v) => v.fecha_viaje));
    const km_mensual = km_total > 0 ? km_total / meses : null;

    // Toneladas: promedio de (tonelaje real / capacidad del camión) por viaje.
    let tonSum = 0;
    let tonN = 0;
    for (const v of cv) {
      const cap = v.camion_id ? capacidadPorCamion.get(v.camion_id) : undefined;
      if (v.tonelaje_real && v.tonelaje_real > 0 && cap && cap > 0) {
        tonSum += v.tonelaje_real / cap;
        tonN += 1;
      }
    }
    const toneladas_pct = tonN > 0 ? tonSum / tonN : null;
    const toneladas_total = cv.reduce((s, v) => s + (v.tonelaje_real ?? 0), 0);

    // Combustible: promedio de L/100km de los camiones que manejó (con dato).
    let combSum = 0;
    let combN = 0;
    if (camsChofer) {
      for (const camId of camsChofer) {
        const v = lp100Camion.get(camId);
        if (v != null) {
          combSum += v;
          combN += 1;
        }
      }
    }
    const combustible_lp100 = combN > 0 ? combSum / combN : null;

    let score: number | null = null;
    let desglose: ScoreDesglose[] = [];
    let conceptos: ConceptoResultado[] = [];
    if (cv.length > 0) {
      const res = calcularScore(
        {
          meses,
          km_mensual,
          ton_pct: toneladas_pct,
          combustible_lp100,
          gomas: gomas_count,
          roturas_leves: varias_leves,
          roturas_graves: varias_graves,
          seguridad: seguridad_eventos,
          siniestros: siniestros_count,
          conducta: ausencias_injustificadas_count + conducta_eventos,
        },
        pScore,
      );
      score = res.score;
      desglose = res.desglose;
      conceptos = res.conceptos;
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
      gomas_count,
      roturas_varias_count: varias.length,
      taller_count,
      siniestros_count,
      ausencias_injustificadas_count,
      conducta_count: ausencias_injustificadas_count + conducta_eventos,
      licencias_activas,
      facturacion_total,
      pesos_por_km,
      km_mensual,
      toneladas_pct,
      toneladas_total,
      combustible_lp100,
      score,
      desglose,
      conceptos,
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
): Promise<{
  score: number;
  desglose: ScoreDesglose[];
  conceptos: ConceptoResultado[];
  viajes_count: number;
} | null> {
  const supabase = createAdminClient();
  const p = await getRankingCriterios();
  // Misma referencia efectiva de consumo que usa el ranking (fija o flota).
  const pScore = await conRefCombustibleEfectiva(supabase, p, hasta);

  const [
    { data: viajes },
    { data: roturas },
    { data: siniestros },
    { data: ausenciasInjust },
    { data: camionActuales },
    { data: historial },
    { data: asignacionDiaria },
  ] = await Promise.all([
    supabase
      .from("viajes")
      .select("camion_id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real")
      .eq("chofer_id", choferId)
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .neq("estado", "cancelado"), // los borrados (soft delete) no puntúan
    supabase.from("roturas_gomas").select("tipo, gravedad").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
    supabase.from("siniestros").select("id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("chofer_ausencias").select("id").eq("chofer_id", choferId).eq("es_vacaciones", false).eq("justificada", false).is("deleted_at", null).gte("fecha_inicio", desde).lte("fecha_inicio", hasta),
    supabase.from("camiones").select("id, capacidad_tn").eq("chofer_actual_id", choferId),
    supabase.from("chofer_camion_historial").select("camion_id, desde, hasta").eq("chofer_id", choferId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("asignacion_diaria").select("camion_id").eq("chofer_id", choferId).gte("fecha", desde).lte("fecha", hasta),
  ]);

  if (!viajes || viajes.length === 0) return null;

  // Apercibimientos/sanciones del chofer (resiliente a la migración de `tipo`).
  const apercibimientos = await fetchApercibimientosTipo(supabase, { desde, hasta, choferId });

  const vs = viajes as {
    camion_id: string | null;
    fecha_viaje: string | null;
    km_con_carga: number | null;
    km_vacios: number | null;
    tonelaje_real: number | null;
  }[];

  const km_total = vs.reduce((s, v) => s + (v.km_con_carga ?? 0) + (v.km_vacios ?? 0), 0);
  const meses = mesesActivos(vs.map((v) => v.fecha_viaje));
  const km_mensual = km_total > 0 ? km_total / meses : null;

  // Camiones que manejó + capacidad nominal de cada uno.
  const camIds = new Set<string>();
  const capacidadPorCamion = new Map<string, number>();
  for (const c of (camionActuales ?? []) as { id: string; capacidad_tn: number | null }[]) {
    camIds.add(c.id);
    if (c.capacidad_tn && c.capacidad_tn > 0) capacidadPorCamion.set(c.id, c.capacidad_tn);
  }
  for (const h of (historial ?? []) as { camion_id: string; desde: string; hasta: string | null }[]) {
    if (h.desde <= hasta && (!h.hasta || h.hasta >= desde)) camIds.add(h.camion_id);
  }
  for (const a of (asignacionDiaria ?? []) as { camion_id: string | null }[]) {
    if (a.camion_id) camIds.add(a.camion_id);
  }

  // Capacidad de los camiones que no son el actual (historial/asignación).
  const faltanCap = [...camIds].filter((id) => !capacidadPorCamion.has(id));
  if (faltanCap.length > 0) {
    const { data: caps } = await supabase.from("camiones").select("id, capacidad_tn").in("id", faltanCap);
    for (const c of (caps ?? []) as { id: string; capacidad_tn: number | null }[]) {
      if (c.capacidad_tn && c.capacidad_tn > 0) capacidadPorCamion.set(c.id, c.capacidad_tn);
    }
  }

  // Toneladas: promedio de tonelaje real / capacidad.
  let tonSum = 0;
  let tonN = 0;
  for (const v of vs) {
    const cap = v.camion_id ? capacidadPorCamion.get(v.camion_id) : undefined;
    if (v.tonelaje_real && v.tonelaje_real > 0 && cap && cap > 0) {
      tonSum += v.tonelaje_real / cap;
      tonN += 1;
    }
  }
  const toneladas_pct = tonN > 0 ? tonSum / tonN : null;

  // Combustible + taller: requieren las cargas/mantenimientos de sus camiones.
  let combustible_lp100: number | null = null;
  let taller = 0;
  if (camIds.size > 0) {
    const [{ data: cargas }, { data: mant }] = await Promise.all([
      supabase
        .from("cargas_combustible")
        .select("camion_id, litros, km_odometro")
        .in("camion_id", [...camIds])
        .gte("fecha", desde)
        .lte("fecha", `${hasta}T23:59:59`),
      supabase
        .from("mantenimientos")
        .select("tipo, camion_id, tipo_servicio:tipos_servicio(codigo)")
        .in("camion_id", [...camIds])
        .gte("fecha", desde)
        .lte("fecha", hasta),
    ]);
    const lp100 = lp100PorCamion((cargas ?? []) as CargaComb[]);
    let combSum = 0;
    let combN = 0;
    for (const id of camIds) {
      const v = lp100.get(id);
      if (v != null) {
        combSum += v;
        combN += 1;
      }
    }
    combustible_lp100 = combN > 0 ? combSum / combN : null;

    const TALLER = new Set(["reparacion", "gomeria"]);
    for (const m of mant ?? []) {
      const ts = Array.isArray(m.tipo_servicio) ? m.tipo_servicio[0] : m.tipo_servicio;
      const codigo = (ts as { codigo?: string } | null)?.codigo;
      if (codigo ? TALLER.has(codigo) : m.tipo === "reparacion") taller += 1;
    }
  }
  void taller; // el taller no pondera en el score de Bárbara (se muestra en el ranking).

  const cr = (roturas ?? []) as { tipo: string | null; gravedad: string | null }[];
  const gomas_count = cr.filter((r) => esGoma(r.tipo)).length;
  const varias = cr.filter((r) => !esGoma(r.tipo));
  const varias_graves = varias.filter((r) => r.gravedad === "grave").length;
  const varias_leves = varias.length - varias_graves;

  const seguridad_eventos = apercibimientos.filter((a) => eventoCuentaSeguridad(a.tipo)).length;
  const conducta_eventos = apercibimientos.filter((a) => eventoCuentaConducta(a.tipo)).length;

  const { score, desglose, conceptos } = calcularScore(
    {
      meses,
      km_mensual,
      ton_pct: toneladas_pct,
      combustible_lp100,
      gomas: gomas_count,
      roturas_leves: varias_leves,
      roturas_graves: varias_graves,
      seguridad: seguridad_eventos,
      siniestros: (siniestros ?? []).length,
      conducta: (ausenciasInjust ?? []).length + conducta_eventos,
    },
    pScore,
  );

  return { score, desglose, conceptos, viajes_count: vs.length };
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
