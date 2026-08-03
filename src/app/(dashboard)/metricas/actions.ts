"use server";

// Métricas históricas (8vo feedback Bárbara, 08/07): las 6 planillas de
// gestión consolidadas en un dashboard con comparación contra el mes anterior
// y contra el mismo mes del año anterior, más los aumentos de tarifa de
// clientes como contexto de la facturación.
//
// Rediseño 11/07: una sola query de ventana (13 meses) alimenta KPIs,
// comparativas, serie histórica (planilla anual), historial por chofer para
// el drawer, y un modo "en vivo" desde viajes para meses sin planillas.
//
// Confidencial: sección `metricas` (por defecto solo administradores).

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { traerTodo } from "@/lib/supabase/traer-todo";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { choferSlug } from "@/lib/chofer-slug";
import { getInflacion, inflacionAcumulada } from "@/lib/inflacion";

// Tablas nuevas, aún no tipadas en database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Flota = "escalables" | "tolvas";

export type MetricaChofer = {
  nombre: string;
  choferId: string | null;
  /** Slug del legajo (/choferes/[slug]) si la fila quedó linkeada. */
  slug: string | null;
  flota: Flota;
  escalTipo: number | null;
  km: number;
  kmVacios: number;
  km100: number;
  facturacion: number;
  sueldoTotal: number;
  sueldoNeto: number;
  toneladas: number;
  ingresoParcial: boolean;
  // Desglose del sueldo (puede faltar en meses viejos).
  retenciones: number | null;
  adelantos: number | null;
  devolPrestamo: number | null;
  embargoJudicial: number | null;
  aguinaldo: number | null;
};

export type TotalesMes = {
  mes: string;
  camiones: number;
  km: number;
  kmVacios: number;
  km100: number;
  facturacion: number;
  sueldoTotal: number;
  factPorKm: number | null;
  pctVacios: number | null;
  pctKm100: number | null;
  pctSueldoFact: number | null;
  toneladasProm: number | null;
};

export type CostoMesRow = {
  mes: string;
  factKm: number | null;
  costoKm: number | null;
  promKm: number | null;
};

/** Un mes de la serie histórica: totales por flota + general. */
export type SerieMes = {
  mes: string;
  general: TotalesMes | null;
  escalables: TotalesMes | null;
  tolvas: TotalesMes | null;
  costoKm: number | null;
  /** true si el mes viene de agregados (metricas_mes) sin detalle por chofer. */
  esAgregado: boolean;
};

/** Punto del historial de un chofer (para el drawer de detalle). */
export type ChoferHistPunto = {
  mes: string;
  flota: Flota;
  km: number;
  kmVacios: number;
  km100: number;
  facturacion: number;
  sueldoTotal: number;
  sueldoNeto: number;
  toneladas: number;
};

export type AumentoCliente = {
  id: string;
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string;
  porcentaje: number;
  observaciones: string | null;
};

/** Diagnóstico de completitud del mes en vivo: qué falta cargar en el sistema. */
export type LiveInfo = {
  viajes: number;
  /** Viajes sin chofer asignado (cuentan en totales, no en la tabla). */
  sinChofer: number;
  /** Viajes con 0 km cargados. */
  sinKm: number;
  /** Viajes sin monto de flete. */
  sinFlete: number;
  /** Viajes sin tonelaje real. */
  sinTonelaje: number;
};

/** Paridad de aumentos (pedido Bárbara 14/07): que el promedio interanual de
 *  los aumentos a clientes vaya a la par de lo que se le aumenta a la gente. */
export type Paridad = {
  /** Aumentos de clientes en los 12 meses hasta el mes visto (compuestos por cliente). */
  clientes: {
    /** Promedio simple entre los clientes con aumentos cargados; null si no hay. */
    promedio: number | null;
    porCliente: { nombre: string; acumulado: number; cantidad: number }[];
  };
  /** % interanual del sueldo promedio por chofer (planillas del Drive). */
  sueldoChoferes: { pct: number | null; mesBase: string | null };
  /** % de aumento del sueldo base de administración y taller (matriz de aumentos). */
  sueldoAdmin: { pct: number | null; mesBase: string | null; parcial: boolean };
  /**
   * Inflación (IPC INDEC) acumulada en la misma ventana de 12 meses, como tercera
   * referencia. Vivía sólo en Sueldos → Aumentos, así que para comparar las tres
   * cosas había que abrir dos pantallas. `hastaMes` es el último mes con dato
   * publicado dentro de la ventana (INDEC publica con ~1 mes y medio de atraso).
   */
  inflacion: { pct: number | null; hastaMes: string | null; completa: boolean };
};

/** Mes de comparación elegido por el usuario (además de mes ant. e interanual). */
export type Comparacion = {
  mes: string;
  choferes: MetricaChofer[];
  totales: Record<Flota | "general", TotalesMes | null>;
  esLive: boolean;
};

export type MetricasData = {
  mes: string; // mes mostrado (ISO día 1)
  /** Mes calendario actual (ISO día 1) — para marcar "hoy" en el selector. */
  hoyMes: string;
  choferes: MetricaChofer[];
  totales: Record<Flota | "general", TotalesMes | null>;
  mesAnterior: Record<Flota | "general", TotalesMes | null> | null;
  anioAnterior: Record<Flota | "general", TotalesMes | null> | null;
  /** Serie de la planilla COSTO VS KM (últimos 14 meses con datos). */
  serieCosto: CostoMesRow[];
  /** Serie histórica de 13 meses (mes visto + 12 hacia atrás), ascendente. */
  serieHistorica: SerieMes[];
  /** Historial por chofer dentro de la ventana de 13 meses (clave: nombre). */
  choferHist: Record<string, ChoferHistPunto[]>;
  /** Meses que tienen planillas por chofer cargadas (para el selector). */
  mesesDisponibles: string[];
  /** Aumentos de tarifa en los últimos 13 meses hasta el mes visto. */
  aumentos: AumentoCliente[];
  /** true si `choferes` viene de los viajes del sistema (mes sin planillas). */
  esLive: boolean;
  /** Diagnóstico de completitud cuando esLive. */
  liveInfo: LiveInfo | null;
  /** Mes de comparación pedido con ?compare=YYYY-MM. */
  comparacion: Comparacion | null;
  /** Aumentos clientes vs sueldos, interanual (pedido Bárbara 14/07). */
  paridad: Paridad;
  canWrite: boolean;
  /** Puede ver /tarifas → los aumentos linkean al historial por cliente. */
  canTarifas: boolean;
};

function mesInfo(monthStr?: string): string {
  if (monthStr && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) return `${monthStr}-01`;
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split("-").map((n) => parseInt(n, 10));
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

function totalesDe(mes: string, rows: MetricaChofer[]): Record<Flota | "general", TotalesMes | null> {
  const calc = (subset: MetricaChofer[]): TotalesMes | null => {
    if (!subset.length) return null;
    const sum = (f: (r: MetricaChofer) => number) => subset.reduce((s, r) => s + f(r), 0);
    const km = sum((r) => r.km);
    const kmVacios = sum((r) => r.kmVacios);
    const km100 = sum((r) => r.km100);
    const facturacion = sum((r) => r.facturacion);
    const sueldoTotal = sum((r) => r.sueldoTotal);
    const conTon = subset.filter((r) => r.toneladas > 0);
    return {
      mes,
      camiones: subset.length,
      km,
      kmVacios,
      km100,
      facturacion,
      sueldoTotal,
      factPorKm: km > 0 ? facturacion / km : null,
      pctVacios: km > 0 ? (kmVacios / km) * 100 : null,
      pctKm100: km > 0 ? (km100 / km) * 100 : null,
      pctSueldoFact: facturacion > 0 ? (sueldoTotal / facturacion) * 100 : null,
      toneladasProm: conTon.length ? conTon.reduce((s, r) => s + r.toneladas, 0) / conTon.length : null,
    };
  };
  return {
    general: calc(rows),
    escalables: calc(rows.filter((r) => r.flota === "escalables")),
    tolvas: calc(rows.filter((r) => r.flota === "tolvas")),
  };
}

function mapChoferRow(r: any): MetricaChofer & { mes: string } {
  return {
    mes: String(r.mes),
    nombre: r.chofer_nombre,
    choferId: r.chofer_id ?? null,
    slug: null, // se completa después con el mapa de choferes
    flota: r.flota as Flota,
    escalTipo: r.escal_tipo ?? null,
    km: Number(r.km_totales ?? 0),
    kmVacios: Number(r.km_vacios ?? 0),
    km100: Number(r.km_100 ?? 0),
    facturacion: Number(r.facturacion ?? 0),
    sueldoTotal: Number(r.sueldo_total ?? 0),
    sueldoNeto: Number(r.sueldo_neto ?? 0),
    toneladas: Number(r.toneladas_prom ?? 0),
    ingresoParcial: Boolean(r.ingreso_parcial),
    retenciones: r.retenciones == null ? null : Number(r.retenciones),
    adelantos: r.adelantos == null ? null : Number(r.adelantos),
    devolPrestamo: r.devol_prestamo == null ? null : Number(r.devol_prestamo),
    embargoJudicial: r.embargo_judicial == null ? null : Number(r.embargo_judicial),
    aguinaldo: r.aguinaldo == null ? null : Number(r.aguinaldo),
  };
}

/** TotalesMes desde una fila agregada de metricas_mes (meses sin choferes). */
function totalesDeAgregado(mes: string, r: any): TotalesMes | null {
  if (!r) return null;
  const km = r.km == null ? 0 : Number(r.km);
  const facturacion = r.facturacion == null ? 0 : Number(r.facturacion);
  const kmVacios = r.km_vacios == null ? 0 : Number(r.km_vacios);
  const km100 = r.km_100 == null ? 0 : Number(r.km_100);
  const sueldoTotal = r.sueldo_total == null ? 0 : Number(r.sueldo_total);
  if (!km && !facturacion) return null;
  return {
    mes,
    camiones: 0, // sin detalle por chofer
    km,
    kmVacios,
    km100,
    facturacion,
    sueldoTotal,
    factPorKm: r.fact_km != null ? Number(r.fact_km) : km > 0 ? facturacion / km : null,
    pctVacios: km > 0 && r.km_vacios != null ? (kmVacios / km) * 100 : null,
    pctKm100: km > 0 && r.km_100 != null ? (km100 / km) * 100 : null,
    pctSueldoFact: facturacion > 0 && r.sueldo_total != null ? (sueldoTotal / facturacion) * 100 : null,
    toneladasProm: r.toneladas_prom == null ? null : Number(r.toneladas_prom),
  };
}

/** Estimación del mes desde viajes, en la MISMA forma que las planillas
 *  (MetricaChofer[]) para que el dashboard se vea igual que un mes cargado.
 *  Sueldos y km al 100% no existen en vivo → quedan en 0 y el cliente los
 *  muestra como "sin datos". flotaDe: flota conocida por planillas previas. */
async function liveDesdeViajes(
  supabase: any,
  mes: string,
  flotaDe: (choferId: string) => Flota | null,
): Promise<{ choferes: MetricaChofer[]; info: LiveInfo } | null> {
  const hasta = addMonths(mes, 1);
  // Un mes cargado pasa las 1000 filas (abril-26: 1322). Sin paginar, las
  // métricas en vivo salían calculadas sobre las primeras 1000 y nada avisaba.
  let data: any[];
  try {
    data = await traerTodo(
      (from, to) =>
        supabase
          .from("viajes")
          .select("chofer_id, km_con_carga, km_vacios, monto_flete, moneda, tipo_cambio, tonelaje_real, es_vacio, chofer:choferes(id, nombre, apellido)")
          .gte("fecha_viaje", mes)
          .lt("fecha_viaje", hasta)
          .order("codigo", { ascending: true })
          .range(from, to),
      { etiqueta: `métricas en vivo de ${mes}` },
    );
  } catch (e) {
    console.error("[métricas en vivo] no se pudieron leer los viajes:", e);
    return null;
  }
  if (!data.length) return null;

  type Acc = { nombre: string; slug: string; km: number; kmVacios: number; facturacion: number; tonSum: number; tonCount: number };
  const porChofer = new Map<string, Acc>();
  const info: LiveInfo = { viajes: 0, sinChofer: 0, sinKm: 0, sinFlete: 0, sinTonelaje: 0 };

  for (const v of data as any[]) {
    const kmCarga = Number(v.km_con_carga ?? 0);
    const kmVac = Number(v.km_vacios ?? 0);
    // Facturación en ARS; USD se convierte con el tipo de cambio del viaje si está.
    const monto = v.monto_flete == null ? 0 :
      v.moneda === "USD" ? Number(v.monto_flete) * Number(v.tipo_cambio ?? 0) : Number(v.monto_flete);
    const ton = v.tonelaje_real == null ? 0 : Number(v.tonelaje_real);

    info.viajes += 1;
    if (!v.chofer?.id) info.sinChofer += 1;
    if (kmCarga + kmVac <= 0) info.sinKm += 1;
    if (monto <= 0 && !v.es_vacio) info.sinFlete += 1;
    if (ton <= 0 && !v.es_vacio) info.sinTonelaje += 1;

    const ch = v.chofer;
    if (!ch?.id) continue;
    const acc = porChofer.get(ch.id) ?? {
      nombre: `${ch.apellido ?? ""} ${ch.nombre ?? ""}`.trim().toUpperCase(),
      slug: choferSlug({ apellido: ch.apellido ?? "", nombre: ch.nombre ?? "" }),
      km: 0, kmVacios: 0, facturacion: 0, tonSum: 0, tonCount: 0,
    };
    acc.km += kmCarga + kmVac;
    acc.kmVacios += kmVac;
    acc.facturacion += monto;
    if (ton > 0) { acc.tonSum += ton; acc.tonCount += 1; }
    porChofer.set(ch.id, acc);
  }

  const choferes: MetricaChofer[] = Array.from(porChofer.entries()).map(([choferId, a]) => ({
    nombre: a.nombre,
    choferId,
    slug: a.slug,
    flota: flotaDe(choferId) ?? "escalables",
    escalTipo: null,
    km: a.km,
    kmVacios: a.kmVacios,
    km100: 0, // no existe en vivo
    facturacion: a.facturacion,
    sueldoTotal: 0, // no existe en vivo
    sueldoNeto: 0,
    toneladas: a.tonCount ? a.tonSum / a.tonCount : 0,
    ingresoParcial: false,
    retenciones: null,
    adelantos: null,
    devolPrestamo: null,
    embargoJudicial: null,
    aguinaldo: null,
  }));

  return { choferes, info };
}

/** En vivo no hay sueldos ni km-100: anular esos ratios en los totales para
 *  que el dashboard muestre "—" en vez de un 0% engañoso. */
function anularMetricasSinDatoLive(
  tot: Record<Flota | "general", TotalesMes | null>,
): Record<Flota | "general", TotalesMes | null> {
  for (const key of ["general", "escalables", "tolvas"] as const) {
    const t = tot[key];
    if (t) {
      t.pctKm100 = null;
      t.pctSueldoFact = null;
    }
  }
  return tot;
}

export async function getMetricasAction(month?: string, compareMonth?: string): Promise<MetricasData> {
  const user = await requireSeccion("metricas", "read");
  const supabase = createAdminClient();

  const hoy = new Date();
  const hoyMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;

  // Meses con planillas cargadas; si no se pidió un mes puntual, mostrar el último.
  // Va PAGINADO: es una fila por chofer×mes (>1.700) y Supabase corta en 1.000,
  // así que sin esto el selector se comía los meses más viejos sin avisar.
  const mesesSet = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await (supabase as any)
      .from("metricas_chofer_mes")
      .select("mes")
      .order("mes", { ascending: false })
      .range(from, from + 999);
    const filas = (data ?? []) as { mes: string }[];
    filas.forEach((r) => mesesSet.add(String(r.mes)));
    if (filas.length < 1000) break;
  }
  const mesesDisponibles = Array.from(mesesSet).sort((a, b) => b.localeCompare(a));

  let mes = mesInfo(month);
  if (!month && mesesDisponibles.length && !mesesDisponibles.includes(mes)) {
    mes = mesesDisponibles[0]; // default: último mes con datos
  }
  const mesPrevio = addMonths(mes, -1);
  const mesInteranual = addMonths(mes, -12);
  const desdeVentana = mesInteranual; // 13 meses: mes visto + 12 hacia atrás

  const [ventanaRes, agregadosRes, costoRes, aumentosRes] = await Promise.all([
    // 13 meses × la flota entera se acerca a las 1000 filas y la va a pasar en
    // cuanto crezca la flota: pagina, y se sigue viendo la ventana completa.
    traerTodo(
      (from, to) =>
        (supabase as any)
          .from("metricas_chofer_mes")
          .select(
            "mes, chofer_nombre, chofer_id, flota, escal_tipo, km_totales, km_vacios, km_100, facturacion, sueldo_total, sueldo_neto, toneladas_prom, ingreso_parcial, retenciones, adelantos, devol_prestamo, embargo_judicial, aguinaldo",
          )
          .gte("mes", desdeVentana)
          .lte("mes", mes)
          .order("mes", { ascending: true })
          .order("chofer_nombre", { ascending: true })
          .range(from, to),
      { etiqueta: "ventana de 13 meses" },
    ).then((data) => ({ data })),
    (supabase as any)
      .from("metricas_mes")
      .select("mes, flota, km, facturacion, fact_km, km_vacios, km_100, sueldo_total, toneladas_prom")
      .gte("mes", desdeVentana)
      .lte("mes", mes),
    (supabase as any)
      .from("metricas_mes")
      .select("mes, flota, fact_km, costo_km_estudio, prom_km")
      .is("flota", null)
      .lte("mes", mes)
      .order("mes", { ascending: false })
      .limit(14),
    (supabase as any)
      .from("clientes_aumentos")
      .select("id, cliente_id, cliente_nombre, vigente_desde, porcentaje, observaciones")
      .gte("vigente_desde", mesInteranual)
      .lte("vigente_desde", addMonths(mes, 1))
      .order("vigente_desde", { ascending: false }),
  ]);

  const ventana = (((ventanaRes.data ?? []) as any[]).map(mapChoferRow));
  const choferes = ventana.filter((r) => r.mes === mes);
  const choferesPrev = ventana.filter((r) => r.mes === mesPrevio);
  const choferesYoY = ventana.filter((r) => r.mes === mesInteranual);

  // Linkeo al legajo por nombre: la planilla trae "APELLIDO INICIAL" (ej.
  // "CEJAS N", "PITTANA MIGUEL"). Se matchea contra Choferes en lectura y solo
  // si el match es inequívoco (el importador dejó chofer_id casi siempre null).
  const { data: todosChoferes } = await supabase.from("choferes").select("id, nombre, apellido");
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
  const candidatos = ((todosChoferes ?? []) as any[]).map((c) => ({
    id: c.id as string,
    ap: normalizar(c.apellido ?? ""),
    no: normalizar(c.nombre ?? ""),
    slug: choferSlug({ apellido: c.apellido ?? "", nombre: c.nombre ?? "" }),
  }));
  const matchCache = new Map<string, { id: string; slug: string } | null>();
  const matchear = (nombrePlanilla: string) => {
    const n = normalizar(nombrePlanilla);
    if (matchCache.has(n)) return matchCache.get(n)!;
    const hits = candidatos.filter((c) => {
      if (!c.ap) return false;
      if (n === c.ap) return true;
      if (n.startsWith(c.ap + " ")) {
        const hint = n.slice(c.ap.length + 1);
        return c.no.startsWith(hint) || c.no.split(" ").some((p) => p.startsWith(hint));
      }
      return false;
    });
    const res = hits.length === 1 ? { id: hits[0].id, slug: hits[0].slug } : null;
    matchCache.set(n, res);
    return res;
  };
  for (const r of ventana) {
    if (!r.choferId) {
      const m = matchear(r.nombre);
      if (m) { r.choferId = m.id; r.slug = m.slug; }
    } else {
      const c = candidatos.find((x) => x.id === r.choferId);
      r.slug = c?.slug ?? null;
    }
  }

  // Serie de costo (planilla COSTO VS KM), ascendente.
  const serieCosto = (((costoRes.data ?? []) as any[]).map((r) => ({
    mes: String(r.mes),
    factKm: r.fact_km == null ? null : Number(r.fact_km),
    costoKm: r.costo_km_estudio == null ? null : Number(r.costo_km_estudio),
    promKm: r.prom_km == null ? null : Number(r.prom_km),
  })) as CostoMesRow[]).reverse();
  const costoPorMes = new Map(serieCosto.map((r) => [r.mes, r.costoKm]));

  // Agregados mensuales (meses históricos sin detalle por chofer).
  const agregados = ((agregadosRes.data ?? []) as any[]);
  const agregadoDe = (m: string, flota: string | null) =>
    agregados.find((r) => String(r.mes) === m && (r.flota ?? null) === flota);

  // Serie histórica: 13 meses ascendentes terminando en el mes visto.
  const serieHistorica: SerieMes[] = [];
  for (let i = -12; i <= 0; i++) {
    const m = addMonths(mes, i);
    const rowsMes = ventana.filter((r) => r.mes === m);
    if (rowsMes.length) {
      const tot = totalesDe(m, rowsMes);
      serieHistorica.push({
        mes: m,
        general: tot.general,
        escalables: tot.escalables,
        tolvas: tot.tolvas,
        costoKm: costoPorMes.get(m) ?? null,
        esAgregado: false,
      });
    } else {
      const general = totalesDeAgregado(m, agregadoDe(m, null));
      const escalables = totalesDeAgregado(m, agregadoDe(m, "escalables"));
      const tolvas = totalesDeAgregado(m, agregadoDe(m, "tolvas"));
      serieHistorica.push({
        mes: m,
        general,
        escalables,
        tolvas,
        costoKm: costoPorMes.get(m) ?? null,
        esAgregado: general != null || escalables != null || tolvas != null,
      });
    }
  }

  // Historial por chofer (para la evolución del drawer).
  const choferHist: Record<string, ChoferHistPunto[]> = {};
  for (const r of ventana) {
    (choferHist[r.nombre] ??= []).push({
      mes: r.mes,
      flota: r.flota,
      km: r.km,
      kmVacios: r.kmVacios,
      km100: r.km100,
      facturacion: r.facturacion,
      sueldoTotal: r.sueldoTotal,
      sueldoNeto: r.sueldoNeto,
      toneladas: r.toneladas,
    });
  }
  for (const serie of Object.values(choferHist)) serie.sort((a, b) => a.mes.localeCompare(b.mes));
  // Alias por choferId (el modo en vivo nombra distinto que la planilla).
  for (const r of ventana) {
    if (r.choferId && !choferHist[r.choferId] && choferHist[r.nombre]) {
      choferHist[r.choferId] = choferHist[r.nombre];
    }
  }

  // Flota conocida de cada chofer (por su planilla más reciente) — para el modo en vivo.
  const flotaPorChoferId = new Map<string, Flota>();
  for (const r of [...ventana].sort((a, b) => a.mes.localeCompare(b.mes))) {
    if (r.choferId) flotaPorChoferId.set(r.choferId, r.flota);
  }
  const flotaDe = (id: string) => flotaPorChoferId.get(id) ?? null;

  // Modo en vivo: el mes visto no tiene planillas y no es futuro → mismos
  // componentes que un mes cargado, alimentados desde los viajes del sistema.
  let esLive = false;
  let liveInfo: LiveInfo | null = null;
  let choferesMes: MetricaChofer[];
  let totalesMes: Record<Flota | "general", TotalesMes | null>;

  const stripMes = (r: MetricaChofer & { mes: string }): MetricaChofer => {
    const { ...rest } = r;
    delete (rest as Partial<typeof rest>).mes;
    return rest;
  };

  if (choferes.length) {
    choferesMes = choferes.map(stripMes);
    totalesMes = totalesDe(mes, choferes);
  } else {
    const live = mes <= hoyMes ? await liveDesdeViajes(supabase, mes, flotaDe) : null;
    if (live) {
      esLive = true;
      liveInfo = live.info;
      choferesMes = live.choferes;
      totalesMes = anularMetricasSinDatoLive(totalesDe(mes, live.choferes));
    } else {
      choferesMes = [];
      totalesMes = totalesDe(mes, []);
    }
  }

  // Mes de comparación elegido (?compare=YYYY-MM): planillas del mes pedido,
  // o los viajes en vivo si ese mes tampoco tiene planillas.
  let comparacion: Comparacion | null = null;
  const compareISO = compareMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(compareMonth) ? `${compareMonth}-01` : null;
  if (compareISO && compareISO !== mes) {
    let rows = ventana.filter((r) => r.mes === compareISO).map(stripMes);
    if (!rows.length) {
      const { data: cmpRaw } = await (supabase as any)
        .from("metricas_chofer_mes")
        .select(
          "mes, chofer_nombre, chofer_id, flota, escal_tipo, km_totales, km_vacios, km_100, facturacion, sueldo_total, sueldo_neto, toneladas_prom, ingreso_parcial, retenciones, adelantos, devol_prestamo, embargo_judicial, aguinaldo",
        )
        .eq("mes", compareISO);
      rows = (((cmpRaw ?? []) as any[]).map(mapChoferRow)).map(stripMes);
    }
    if (rows.length) {
      comparacion = { mes: compareISO, choferes: rows, totales: totalesDe(compareISO, rows), esLive: false };
    } else if (compareISO <= hoyMes) {
      const liveCmp = await liveDesdeViajes(supabase, compareISO, flotaDe);
      if (liveCmp) {
        comparacion = {
          mes: compareISO,
          choferes: liveCmp.choferes,
          totales: anularMetricasSinDatoLive(totalesDe(compareISO, liveCmp.choferes)),
          esLive: true,
        };
      }
    }
  }

  // ── Paridad de aumentos: clientes vs sueldos, interanual ────────────────
  // 1) Clientes: % compuestos por cliente en los 12 meses hasta el mes visto.
  const aumentosRows = ((aumentosRes.data ?? []) as any[]);
  const porCliente = new Map<string, { acumulado: number; cantidad: number }>();
  for (const a of aumentosRows) {
    const desde = String(a.vigente_desde);
    if (desde < mesInteranual || desde >= addMonths(mes, 1)) continue;
    const prev = porCliente.get(a.cliente_nombre) ?? { acumulado: 1, cantidad: 0 };
    prev.acumulado *= 1 + Number(a.porcentaje) / 100;
    prev.cantidad += 1;
    porCliente.set(a.cliente_nombre, prev);
  }
  const clientesDetalle = Array.from(porCliente.entries())
    .map(([nombre, v]) => ({ nombre, acumulado: (v.acumulado - 1) * 100, cantidad: v.cantidad }))
    .sort((a, b) => b.acumulado - a.acumulado);
  const clientesPromedio = clientesDetalle.length
    ? clientesDetalle.reduce((s, c) => s + c.acumulado, 0) / clientesDetalle.length
    : null;

  // 2) Sueldos de choferes: sueldo promedio por chofer del mes visto vs mismo
  //    mes del año anterior (mismo mes ⇒ el aguinaldo no distorsiona).
  const promSueldo = (rows: { sueldoTotal: number }[]) => {
    const con = rows.filter((r) => r.sueldoTotal > 0);
    return con.length ? con.reduce((s, r) => s + r.sueldoTotal, 0) / con.length : null;
  };
  const sueldoNow = promSueldo(choferes);
  const sueldoPrev = promSueldo(choferesYoY);
  const sueldoChoferesPct = sueldoNow != null && sueldoPrev != null && sueldoPrev > 0
    ? (sueldoNow / sueldoPrev - 1) * 100
    : null;

  // 3) Sueldo base de administración y taller (matriz sueldos_admin_aumentos:
  //    una fila por persona×mes con el sueldo base vigente).
  let sueldoAdmin: Paridad["sueldoAdmin"] = { pct: null, mesBase: null, parcial: false };
  {
    const { data: baseRows } = await (supabase as any)
      .from("sueldos_admin_aumentos")
      .select("chofer_id, vigente_desde, sueldo_base")
      .lte("vigente_desde", mes)
      .order("vigente_desde", { ascending: true });
    const rows = ((baseRows ?? []) as any[]).map((r) => ({
      persona: String(r.chofer_id),
      mes: String(r.vigente_desde),
      base: Number(r.sueldo_base ?? 0),
    })).filter((r) => r.base > 0);
    if (rows.length) {
      const mesMin = rows[0].mes;
      const objetivoBase = mesInteranual >= mesMin ? mesInteranual : mesMin;
      // Último sueldo base vigente ≤ fecha, por persona.
      const vigenteA = (fecha: string) => {
        const porPersona = new Map<string, number>();
        for (const r of rows) if (r.mes <= fecha) porPersona.set(r.persona, r.base);
        return porPersona;
      };
      const ahora = vigenteA(mes);
      const antes = vigenteA(objetivoBase);
      // Solo personas presentes en ambos puntos (comparación justa).
      let sumaAhora = 0, sumaAntes = 0, n = 0;
      for (const [persona, base] of ahora) {
        const b0 = antes.get(persona);
        if (b0 && b0 > 0) { sumaAhora += base; sumaAntes += b0; n += 1; }
      }
      if (n > 0 && sumaAntes > 0) {
        sueldoAdmin = {
          pct: (sumaAhora / sumaAntes - 1) * 100,
          mesBase: objetivoBase,
          parcial: objetivoBase > mesInteranual, // la serie no llega a 12 meses atrás
        };
      }
    }
  }

  // 4) Inflación de la misma ventana (mes interanual + 1 … mes visto), para
  //    poder leer las tres cosas juntas. INDEC publica con atraso: si falta el
  //    último mes se acumula hasta donde llega y se avisa que está incompleta.
  let inflacionParidad: Paridad["inflacion"] = { pct: null, hastaMes: null, completa: false };
  {
    const { serie } = await getInflacion();
    const desde = addMonths(mesInteranual, 1);
    const disponibles = serie.filter((s) => s.mes >= desde && s.mes <= mes);
    const hastaMes = disponibles.length ? disponibles[disponibles.length - 1]!.mes : null;
    if (hastaMes) {
      inflacionParidad = {
        pct: inflacionAcumulada(serie, desde, hastaMes),
        hastaMes,
        completa: hastaMes === mes,
      };
    }
  }

  const paridad: Paridad = {
    clientes: { promedio: clientesPromedio, porCliente: clientesDetalle },
    sueldoChoferes: { pct: sueldoChoferesPct, mesBase: sueldoChoferesPct != null ? mesInteranual : null },
    sueldoAdmin,
    inflacion: inflacionParidad,
  };

  return {
    mes,
    hoyMes,
    choferes: choferesMes,
    totales: totalesMes,
    mesAnterior: choferesPrev.length ? totalesDe(mesPrevio, choferesPrev) : null,
    anioAnterior: choferesYoY.length ? totalesDe(mesInteranual, choferesYoY) : null,
    serieCosto,
    serieHistorica,
    choferHist,
    mesesDisponibles,
    aumentos: ((aumentosRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      clienteId: r.cliente_id ?? null,
      clienteNombre: r.cliente_nombre,
      vigenteDesde: String(r.vigente_desde),
      porcentaje: Number(r.porcentaje),
      observaciones: r.observaciones ?? null,
    })),
    esLive,
    liveInfo,
    comparacion,
    paridad,
    canWrite: hasSeccion(user, "metricas", "write"),
    canTarifas: hasSeccion(user, "tarifas", "read"),
  };
}

// ── Aumentos de tarifa de clientes ─────────────────────────────────────────

export async function getClientesParaAumentoAction(): Promise<{ id: string; nombre: string }[]> {
  await requireSeccion("metricas", "read");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, razon_social")
    .eq("estado", "activo")
    .order("razon_social");
  return ((data ?? []) as any[]).map((c) => ({ id: c.id, nombre: c.razon_social }));
}

export async function crearAumentoClienteAction(input: {
  clienteId: string | null;
  clienteNombre: string;
  vigenteDesde: string; // YYYY-MM-DD
  porcentaje: number;
  observaciones?: string;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("metricas", "write");
  const supabase = createAdminClient();

  const nombre = input.clienteNombre.trim();
  if (!nombre) return { error: "Falta el cliente." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vigenteDesde)) return { error: "Fecha inválida." };
  if (!Number.isFinite(input.porcentaje) || input.porcentaje <= -100 || input.porcentaje >= 1000) {
    return { error: "El porcentaje no es válido." };
  }

  const { error } = await (supabase as any).from("clientes_aumentos").insert({
    cliente_id: input.clienteId,
    cliente_nombre: nombre,
    vigente_desde: input.vigenteDesde,
    porcentaje: input.porcentaje,
    observaciones: input.observaciones?.trim() || null,
    created_by: user.id,
  });
  if (error) {
    console.error("Error al crear aumento de cliente:", error);
    return { error: "No se pudo guardar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "cliente_aumento",
    entidadId: nombre,
    valoresNuevos: { ...input },
    metadata: { origen: "metricas" },
  });

  revalidatePath("/metricas");
  revalidatePath("/tarifas");
  return { ok: true };
}

export async function eliminarAumentoClienteAction(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("metricas", "write");
  const supabase = createAdminClient();

  const { data: prev } = await (supabase as any)
    .from("clientes_aumentos")
    .select("cliente_nombre, vigente_desde, porcentaje")
    .eq("id", id)
    .maybeSingle();

  const { error } = await (supabase as any).from("clientes_aumentos").delete().eq("id", id);
  if (error) {
    console.error("Error al eliminar aumento:", error);
    return { error: "No se pudo eliminar el aumento." };
  }

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "cliente_aumento",
    entidadId: id,
    valoresAnteriores: prev ?? null,
    metadata: { origen: "metricas" },
  });

  revalidatePath("/metricas");
  revalidatePath("/tarifas");
  return { ok: true };
}
