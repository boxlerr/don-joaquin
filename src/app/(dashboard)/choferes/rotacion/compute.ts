// Lógica pura de rotación (client-safe: sin "server-only" ni acceso a DB).
// Permite recalcular KPIs/charts/tabla en el cliente al filtrar/comparar, al
// instante, sobre el dataset que trae el server.

export type TipoBaja =
  | "renuncia_voluntaria"
  | "despido"
  | "jubilacion"
  | "abandono"
  | "otro";

export const TIPO_BAJA_LABEL: Record<TipoBaja, string> = {
  renuncia_voluntaria: "Renuncia voluntaria",
  despido: "Despido",
  jubilacion: "Jubilación",
  abandono: "Abandono",
  otro: "Otro",
};

export const TIPO_BAJA_OPTIONS: { value: TipoBaja; label: string }[] = (
  Object.keys(TIPO_BAJA_LABEL) as TipoBaja[]
).map((value) => ({ value, label: TIPO_BAJA_LABEL[value] }));

export type ClaseBaja = "voluntaria" | "involuntaria" | "jubilacion";

export const CLASE_BAJA: Record<TipoBaja, ClaseBaja> = {
  renuncia_voluntaria: "voluntaria",
  abandono: "voluntaria",
  despido: "involuntaria",
  otro: "involuntaria",
  jubilacion: "jubilacion",
};

export const CLASE_LABEL: Record<ClaseBaja, string> = {
  voluntaria: "Voluntaria",
  involuntaria: "Involuntaria",
  jubilacion: "Jubilación",
};

export const CLASE_COLOR: Record<ClaseBaja, string> = {
  voluntaria: "#0088D1",
  involuntaria: "#F59E0B",
  jubilacion: "#94A3B8",
};

export type TramoAntiguedad = "menos_1" | "1_3" | "3_5" | "mas_5" | "sin_dato";

export const TRAMOS: TramoAntiguedad[] = ["menos_1", "1_3", "3_5", "mas_5", "sin_dato"];

export const TRAMO_LABEL: Record<TramoAntiguedad, string> = {
  menos_1: "Menos de 1 año",
  "1_3": "Entre 1 y 3 años",
  "3_5": "Entre 3 y 5 años",
  mas_5: "Más de 5 años",
  sin_dato: "Sin dato",
};

export const TRAMO_COLOR: Record<TramoAntiguedad, string> = {
  menos_1: "#EF4444",
  "1_3": "#F59E0B",
  "3_5": "#38BDF8",
  mas_5: "#10B981",
  sin_dato: "#CBD5E1",
};

export const BENCHMARK_MIN = 12;
export const BENCHMARK_MAX = 20;

export function tramoDeMeses(meses: number | null | undefined): TramoAntiguedad {
  if (meses === null || meses === undefined) return "sin_dato";
  if (meses < 12) return "menos_1";
  if (meses < 36) return "1_3";
  if (meses < 60) return "3_5";
  return "mas_5";
}

export function antiguedadTexto(meses: number | null | undefined): string {
  if (meses === null || meses === undefined) return "—";
  if (meses < 1) return "< 1 mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto === 0
    ? `${anios} ${anios === 1 ? "año" : "años"}`
    : `${anios} ${anios === 1 ? "año" : "años"} ${resto} ${resto === 1 ? "mes" : "meses"}`;
}

export type BajaRotacion = {
  id: string;
  chofer_id: string | null;
  nombre: string;
  fecha_ingreso: string | null;
  fecha_egreso: string | null;
  anio: number;
  antiguedad_meses: number | null;
  antiguedad_texto: string | null;
  tipo_baja: TipoBaja;
  motivo: string | null;
  base_zona: string | null;
  observaciones: string | null;
};

export type AltaDelAnio = {
  id: string;
  nombre: string;
  apellido: string;
  localidad: string | null;
  fecha_ingreso: string;
  estado: string;
};

export type ParamAnio = {
  anio: number;
  flota_inicial: number | null;
  flota_final: number | null;
};

/** Dotación estimada desde el roster para un año sin parámetros cargados. */
export type DotacionEstimada = { anio: number; inicial: number; final: number };

export type Filtros = {
  tipos: TipoBaja[];
  tramos: TramoAntiguedad[];
  base: string | null;
};

export const FILTROS_VACIOS: Filtros = { tipos: [], tramos: [], base: null };

export function hayFiltros(f: Filtros): boolean {
  return f.tipos.length > 0 || f.tramos.length > 0 || !!f.base;
}

export function aplicarFiltros(bajas: BajaRotacion[], f: Filtros): BajaRotacion[] {
  return bajas.filter((b) => {
    if (f.tipos.length && !f.tipos.includes(b.tipo_baja)) return false;
    if (f.tramos.length && !f.tramos.includes(tramoDeMeses(b.antiguedad_meses))) return false;
    if (f.base && (b.base_zona ?? "") !== f.base) return false;
    return true;
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export type MetricasAnio = {
  anio: number;
  flota_inicial: number | null;
  flota_final: number | null;
  dotacion_promedio: number;
  flota_fuente: "cargada" | "estimada";
  altas: number;
  bajas: number;
  ir_total: number;
  ir_voluntaria: number;
  ir_involuntaria: number;
  ir_jubilacion: number;
  por_tipo: { tipo: TipoBaja; label: string; clase: ClaseBaja; count: number }[];
  por_clase: { clase: ClaseBaja; label: string; color: string; count: number; pct: number }[];
  por_tramo: { tramo: TramoAntiguedad; label: string; color: string; count: number; pct: number }[];
  antiguedad_promedio_meses: number | null;
  pct_menos_3_anios: number;
  bajas_detalle: BajaRotacion[];
};

/** Computa todas las métricas de un año a partir de sus bajas (ya filtradas) y
 *  la dotación (cargada o estimada). Puro: corre en el cliente. */
export function computeMetricas(opts: {
  anio: number;
  bajas: BajaRotacion[];
  param: ParamAnio | null;
  estimada: DotacionEstimada | null;
  altasCount: number;
}): MetricasAnio {
  const { anio, bajas, param, estimada, altasCount } = opts;

  let flota_inicial: number | null;
  let flota_final: number | null;
  let flota_fuente: "cargada" | "estimada";
  if (param && (param.flota_inicial != null || param.flota_final != null)) {
    flota_inicial = param.flota_inicial ?? estimada?.inicial ?? 0;
    flota_final = param.flota_final ?? estimada?.final ?? 0;
    flota_fuente = "cargada";
  } else {
    flota_inicial = estimada?.inicial ?? 0;
    flota_final = estimada?.final ?? 0;
    flota_fuente = "estimada";
  }
  const dotacion_promedio = ((flota_inicial ?? 0) + (flota_final ?? 0)) / 2;
  const total = bajas.length;
  const ir = (n: number) => (dotacion_promedio > 0 ? r1((n / dotacion_promedio) * 100) : 0);

  let vol = 0, invol = 0, jub = 0;
  const tipoCount = new Map<TipoBaja, number>();
  const tramoCount = new Map<TramoAntiguedad, number>();
  const antig: number[] = [];
  let menos3 = 0;
  for (const b of bajas) {
    const clase = CLASE_BAJA[b.tipo_baja] ?? "involuntaria";
    if (clase === "voluntaria") vol++;
    else if (clase === "jubilacion") jub++;
    else invol++;
    tipoCount.set(b.tipo_baja, (tipoCount.get(b.tipo_baja) ?? 0) + 1);
    const tr = tramoDeMeses(b.antiguedad_meses);
    tramoCount.set(tr, (tramoCount.get(tr) ?? 0) + 1);
    if (b.antiguedad_meses != null) {
      antig.push(b.antiguedad_meses);
      if (b.antiguedad_meses < 36) menos3++;
    }
  }

  const por_tipo = (Object.keys(TIPO_BAJA_LABEL) as TipoBaja[])
    .map((tipo) => ({ tipo, label: TIPO_BAJA_LABEL[tipo], clase: CLASE_BAJA[tipo], count: tipoCount.get(tipo) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const claseCount: Record<ClaseBaja, number> = { voluntaria: vol, involuntaria: invol, jubilacion: jub };
  const por_clase = (["voluntaria", "involuntaria", "jubilacion"] as ClaseBaja[])
    .map((clase) => ({
      clase,
      label: CLASE_LABEL[clase],
      color: CLASE_COLOR[clase],
      count: claseCount[clase],
      pct: total > 0 ? r1((claseCount[clase] / total) * 100) : 0,
    }))
    .filter((c) => c.count > 0);

  const por_tramo = TRAMOS.map((tramo) => {
    const count = tramoCount.get(tramo) ?? 0;
    return {
      tramo,
      label: TRAMO_LABEL[tramo],
      color: TRAMO_COLOR[tramo],
      count,
      pct: total > 0 ? r1((count / total) * 100) : 0,
    };
  }).filter((t) => t.count > 0);

  const antiguedad_promedio_meses =
    antig.length > 0 ? Math.round(antig.reduce((s, n) => s + n, 0) / antig.length) : null;
  const conDato = antig.length;
  const pct_menos_3_anios = conDato > 0 ? r1((menos3 / conDato) * 100) : 0;

  return {
    anio,
    flota_inicial,
    flota_final,
    dotacion_promedio: r1(dotacion_promedio),
    flota_fuente,
    altas: altasCount,
    bajas: total,
    ir_total: ir(total),
    ir_voluntaria: ir(vol),
    ir_involuntaria: ir(invol),
    ir_jubilacion: ir(jub),
    por_tipo,
    por_clase,
    por_tramo,
    antiguedad_promedio_meses,
    pct_menos_3_anios,
    bajas_detalle: bajas,
  };
}

export function nivelBenchmark(ir: number): "bajo" | "dentro" | "alto" {
  if (ir < BENCHMARK_MIN) return "bajo";
  if (ir > BENCHMARK_MAX) return "alto";
  return "dentro";
}
