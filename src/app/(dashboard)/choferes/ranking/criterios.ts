// Modelo de score de choferes — planilla de Bárbara ("score choferes.xlsx", jun 2026).
// Base 100; cada CONCEPTO resta puntos de su propio tope (ponderación) según
// el NIVEL en el que cae el dato del mes. El puntaje de un concepto nunca es
// negativo. Score final = suma de los puntos obtenidos de los 8 conceptos
// (mínimo 0, máximo 100).
//
// Todo es CONFIGURABLE por el admin desde la web: los topes (pesos), las
// referencias y el % que resta cada nivel de cada concepto. Los rangos/umbrales
// (qué cuenta como "promedio/malo/muy malo") quedan fijos por ahora.
//
// SIN "server-only": se importa tanto desde el server (lib.ts / actions.ts)
// como desde los client components (CriteriosButton, ScoreInfoButton).

export type ConceptoKey =
  | "km"
  | "toneladas"
  | "combustible"
  | "gomas"
  | "roturas_varias"
  | "seguridad"
  | "siniestros"
  | "conducta";

// % de descuento (0..1) por nivel, para cada concepto. Las claves de nivel son
// propias de cada concepto (los conteos tienen distintos cortes).
export type TramosConfig = {
  km: { promedio: number; malo: number; muy_malo: number };
  toneladas: { leve: number; importante: number; grave: number };
  combustible: { promedio: number; malo: number; muy_malo: number };
  gomas: { uno: number; dos: number; tres_mas: number };
  roturas_varias: { leve: number; medio: number; grave: number };
  seguridad: { uno: number; dos_mas: number };
  siniestros: { uno: number; dos_mas: number };
  conducta: { dos: number; tres: number; cuatro_mas: number };
};

/** Configuración completa del score, editable por el admin. */
export type RankingCriterios = {
  /** Puntos máximos de cada concepto (ponderación). Deberían sumar 100. */
  topes: Record<ConceptoKey, number>;
  /** km/mes considerados "muy bueno" (100% del objetivo). */
  km_ref_mensual: number;
  /** L/100km de referencia: hasta este valor el consumo es "muy bueno". */
  combustible_ref: number;
  /** % de descuento por nivel de cada concepto. */
  tramos: TramosConfig;
};

// Defaults = planilla de Bárbara (solapa 1 "Conceptos y Ponderación", suman 100,
// sin "Facturación por km" — eso es productividad, no conducta).
export const RANKING_CRITERIOS_DEFAULT: RankingCriterios = {
  topes: {
    km: 18,
    toneladas: 10,
    combustible: 13,
    gomas: 9,
    roturas_varias: 9,
    seguridad: 20,
    siniestros: 11,
    conducta: 10,
  },
  km_ref_mensual: 13500,
  combustible_ref: 33.6,
  tramos: {
    km: { promedio: 0.35, malo: 0.7, muy_malo: 1 },
    toneladas: { leve: 0.4, importante: 0.7, grave: 1 },
    combustible: { promedio: 0.35, malo: 0.7, muy_malo: 1 },
    gomas: { uno: 0.3, dos: 0.65, tres_mas: 1 },
    roturas_varias: { leve: 0.3, medio: 0.7, grave: 1 },
    seguridad: { uno: 0.7, dos_mas: 1 },
    siniestros: { uno: 0.6, dos_mas: 1 },
    conducta: { dos: 0.35, tres: 0.7, cuatro_mas: 1 },
  },
};

/** Metadatos de cada concepto para la UI (orden de aparición del Excel). */
export const CONCEPTOS_META: {
  key: ConceptoKey;
  label: string;
  categoria: string;
  comoSeMide: string;
}[] = [
  { key: "km", label: "Cumplimiento de kilómetros", categoria: "Productividad", comoSeMide: "Km del mes vs. el objetivo (referencia editable)." },
  { key: "toneladas", label: "Toneladas transportadas", categoria: "Productividad", comoSeMide: "Tonelaje real promedio vs. la capacidad del camión asignado." },
  { key: "combustible", label: "Consumo de combustible", categoria: "Eficiencia", comoSeMide: "Litros cada 100 km de los camiones que manejó (cargas de gasoil)." },
  { key: "gomas", label: "Gomas rotas/dañadas", categoria: "Cuidado del equipo", comoSeMide: "Cantidad de gomas/llantas rotas o dañadas en el mes." },
  { key: "roturas_varias", label: "Roturas varias", categoria: "Cuidado del equipo", comoSeMide: "Daños por mal uso (caja volcadora, mecánica, carrocería, etc.)." },
  { key: "seguridad", label: "Seguridad (actas + multas)", categoria: "Seguridad", comoSeMide: "Actas/apercibimientos + multas de tránsito del mes." },
  { key: "siniestros", label: "Accidentes/siniestros", categoria: "Seguridad", comoSeMide: "Accidentes/siniestros con responsabilidad del chofer." },
  { key: "conducta", label: "Conducta laboral", categoria: "Conducta laboral", comoSeMide: "Adelantos + ausentismo + llamados de atención (sumados)." },
];

/** Niveles editables por concepto (clave + etiqueta + condición fija). Driver de
 * la UI de configuración y de la metodología. El nivel "muy bueno" (0%) no se
 * lista porque nunca resta. */
export const TRAMOS_META: Record<ConceptoKey, { key: string; label: string; condicion: string }[]> = {
  km: [
    { key: "promedio", label: "Promedio", condicion: "85–99% del objetivo" },
    { key: "malo", label: "Malo", condicion: "70–84% del objetivo" },
    { key: "muy_malo", label: "Muy malo", condicion: "menos del 70%" },
  ],
  toneladas: [
    { key: "leve", label: "Desvío leve", condicion: "±15% de la capacidad" },
    { key: "importante", label: "Desvío importante", condicion: "±25% de la capacidad" },
    { key: "grave", label: "Sub/sobrecarga", condicion: "más de ±25%" },
  ],
  combustible: [
    { key: "promedio", label: "Promedio", condicion: "hasta +7% de la referencia" },
    { key: "malo", label: "Malo", condicion: "+7% a +15%" },
    { key: "muy_malo", label: "Muy malo", condicion: "+15% o más" },
  ],
  gomas: [
    { key: "uno", label: "1 por mes", condicion: "1 evento en el mes" },
    { key: "dos", label: "2 por mes", condicion: "2 eventos en el mes" },
    { key: "tres_mas", label: "3 o más", condicion: "3+ eventos en el mes" },
  ],
  roturas_varias: [
    { key: "leve", label: "1 leve", condicion: "1 daño leve en el mes" },
    { key: "medio", label: "1 grave / 2 leves", condicion: "1 grave o 2 leves" },
    { key: "grave", label: "2+ graves / 3+ leves", condicion: "varios o graves" },
  ],
  seguridad: [
    { key: "uno", label: "1 por mes", condicion: "1 acta/multa en el mes" },
    { key: "dos_mas", label: "2 o más", condicion: "2+ en el mes" },
  ],
  siniestros: [
    { key: "uno", label: "1 por mes", condicion: "1 siniestro en el mes" },
    { key: "dos_mas", label: "2 o más", condicion: "2+ en el mes" },
  ],
  conducta: [
    { key: "dos", label: "2 por mes", condicion: "2 eventos en el mes" },
    { key: "tres", label: "3 por mes", condicion: "3 eventos en el mes" },
    { key: "cuatro_mas", label: "4 o más", condicion: "4+ eventos en el mes" },
  ],
};

// ---------------------------------------------------------------------------
// Cálculo de descuento por concepto: dado el dato del mes, devuelve el % de
// descuento (0..1) tomándolo de la config (boundaries fijos, % editables).
// ---------------------------------------------------------------------------

export function descuentoKm(pctObjetivo: number, t: TramosConfig["km"]): number {
  if (pctObjetivo >= 1.0) return 0;
  if (pctObjetivo >= 0.85) return t.promedio;
  if (pctObjetivo >= 0.7) return t.malo;
  return t.muy_malo;
}

export function descuentoToneladas(pctCap: number, t: TramosConfig["toneladas"]): number {
  const d = Math.abs(pctCap - 1);
  if (pctCap >= 0.95 && pctCap <= 1.05) return 0;
  if (d <= 0.15) return t.leve;
  if (d <= 0.25) return t.importante;
  return t.grave;
}

export function descuentoCombustible(lp100: number, ref: number, t: TramosConfig["combustible"]): number {
  if (lp100 <= ref) return 0;
  const exceso = lp100 / ref - 1;
  if (exceso <= 0.07) return t.promedio;
  if (exceso <= 0.15) return t.malo;
  return t.muy_malo;
}

export function descuentoGomas(eventos: number, t: TramosConfig["gomas"]): number {
  if (eventos <= 0) return 0;
  if (eventos === 1) return t.uno;
  if (eventos === 2) return t.dos;
  return t.tres_mas;
}

export function descuentoRoturasVarias(leves: number, graves: number, t: TramosConfig["roturas_varias"]): number {
  if (graves >= 2 || leves >= 3) return t.grave;
  if (graves >= 1 || leves >= 2) return t.medio;
  if (leves >= 1) return t.leve;
  return 0;
}

export function descuentoSeguridad(eventos: number, t: TramosConfig["seguridad"]): number {
  if (eventos <= 0) return 0;
  if (eventos === 1) return t.uno;
  return t.dos_mas;
}

export function descuentoSiniestros(eventos: number, t: TramosConfig["siniestros"]): number {
  if (eventos <= 0) return 0;
  if (eventos === 1) return t.uno;
  return t.dos_mas;
}

export function descuentoConducta(eventos: number, t: TramosConfig["conducta"]): number {
  if (eventos <= 1) return 0;
  if (eventos === 2) return t.dos;
  if (eventos === 3) return t.tres;
  return t.cuatro_mas;
}

// ── Eventos manuales por chofer (tabla chofer_apercibimientos.tipo) ───────────
// Cada evento cargado a mano suma a un concepto distinto del score:
//   Seguridad ← apercibimiento, multa (de tránsito)
//   Conducta  ← llamado_atencion, adelanto (de sueldo)
// Las ausencias injustificadas también suman a Conducta, pero salen de otra tabla.
export type ApercibimientoTipo = "apercibimiento" | "multa" | "llamado_atencion" | "adelanto";

/** true si el evento pesa en Seguridad (default para tipo nulo/desconocido). */
export function eventoCuentaSeguridad(tipo: string | null | undefined): boolean {
  return tipo === "multa" || tipo === "apercibimiento" || tipo == null;
}

/** true si el evento pesa en Conducta laboral. */
export function eventoCuentaConducta(tipo: string | null | undefined): boolean {
  return tipo === "llamado_atencion" || tipo === "adelanto";
}

// ---------------------------------------------------------------------------
// Persistencia: TODA la config va en una sola fila JSON de `parametros_sistema`
// (clave `ranking_score_config`). Más limpio que decenas de filas sueltas.
// ---------------------------------------------------------------------------

export const CONFIG_CLAVE = "ranking_score_config";

const clampPct = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};
const numOr = (v: unknown, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/** Combina una config (posiblemente parcial o vieja) con los defaults, validando
 * tipos. Cualquier campo faltante o inválido cae al default. */
export function mergeCriterios(raw: unknown): RankingCriterios {
  const d = RANKING_CRITERIOS_DEFAULT;
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const topesIn = (obj.topes && typeof obj.topes === "object" ? obj.topes : {}) as Record<string, unknown>;
  const tramosIn = (obj.tramos && typeof obj.tramos === "object" ? obj.tramos : {}) as Record<string, unknown>;

  const topes = { ...d.topes };
  for (const k of Object.keys(d.topes) as ConceptoKey[]) {
    topes[k] = Math.max(0, Math.round(numOr(topesIn[k], d.topes[k])));
  }

  const tramos = {} as TramosConfig;
  for (const k of Object.keys(d.tramos) as ConceptoKey[]) {
    const def = d.tramos[k] as Record<string, number>;
    const inN = (tramosIn[k] && typeof tramosIn[k] === "object" ? tramosIn[k] : {}) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const nivel of Object.keys(def)) out[nivel] = nivel in inN ? clampPct(inN[nivel]) : def[nivel];
    (tramos as Record<string, unknown>)[k] = out;
  }

  return {
    topes,
    km_ref_mensual: Math.max(1, Math.round(numOr(obj.km_ref_mensual, d.km_ref_mensual))),
    combustible_ref: Math.max(0.1, numOr(obj.combustible_ref, d.combustible_ref)),
    tramos,
  };
}

// ---------------------------------------------------------------------------
// Cálculo del score. Lógica PURA (sin DB): la usan el server (lib.ts) y los tests.
// ---------------------------------------------------------------------------

export type ScoreDesglose = { label: string; puntos: number };

export type ConceptoResultado = {
  key: ConceptoKey;
  label: string;
  tope: number;
  obtenido: number;
  descuento: number;
  detalle: string;
  sinDatos: boolean;
};

/** Datos del chofer ya agregados, listos para puntuar. */
export type ScoreInputs = {
  /** Meses con actividad del chofer (mínimo 1) — normaliza km y conteos. */
  meses: number;
  km_mensual: number | null;
  ton_pct: number | null;
  combustible_lp100: number | null;
  gomas: number;
  roturas_leves: number;
  roturas_graves: number;
  seguridad: number;
  siniestros: number;
  conducta: number;
};

function fmtMiles(n: number): string {
  return Math.round(n).toLocaleString("es-AR");
}
function fmtPct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}
function fmtDec1(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function eventosTxt(total: number, meses: number): string {
  if (total <= 0) return "sin eventos";
  if (meses <= 1) return `${total} evento${total !== 1 ? "s" : ""}`;
  return `${total} en ${meses} meses (≈${(total / meses).toLocaleString("es-AR", { maximumFractionDigits: 1 })}/mes)`;
}

/**
 * Calcula score (0-100) + desglose con el modelo de Bárbara: base 100, cada
 * concepto resta de su tope según el nivel del dato del mes (con los % de la config).
 *
 * Los conteos de eventos se normalizan a "por mes" (count / meses) porque las
 * escalas están definidas por mes. Los conceptos sin fuente de datos (combustible
 * sin cargas, toneladas sin tonelaje) dan el tope completo: la ausencia de datos
 * nunca penaliza.
 */
export function calcularScore(
  inp: ScoreInputs,
  c: RankingCriterios,
): { score: number; desglose: ScoreDesglose[]; conceptos: ConceptoResultado[] } {
  const meses = Math.max(1, inp.meses);
  const labelOf = (k: ConceptoKey) => CONCEPTOS_META.find((m) => m.key === k)!.label;
  const conceptos: ConceptoResultado[] = [];

  const push = (key: ConceptoKey, descPct: number, detalle: string, sinDatos = false) => {
    const tope = c.topes[key];
    const descuento = sinDatos ? 0 : Math.round(tope * descPct);
    conceptos.push({ key, label: labelOf(key), tope, obtenido: tope - descuento, descuento, detalle, sinDatos });
  };

  const porMes = (n: number) => Math.round(n / meses);

  // 1. Cumplimiento de kilómetros
  if (inp.km_mensual == null) {
    push("km", 0, "sin km cargados", true);
  } else {
    const pct = c.km_ref_mensual > 0 ? inp.km_mensual / c.km_ref_mensual : 1;
    push("km", descuentoKm(pct, c.tramos.km), `${fmtMiles(inp.km_mensual)} km/mes (${fmtPct(pct)} del objetivo)`);
  }

  // 3. Toneladas transportadas
  if (inp.ton_pct == null) {
    push("toneladas", 0, "sin tonelaje cargado", true);
  } else {
    push("toneladas", descuentoToneladas(inp.ton_pct, c.tramos.toneladas), `${fmtPct(inp.ton_pct)} de la capacidad`);
  }

  // 6. Consumo de combustible
  if (inp.combustible_lp100 == null) {
    push("combustible", 0, "sin cargas de gasoil", true);
  } else {
    push("combustible", descuentoCombustible(inp.combustible_lp100, c.combustible_ref, c.tramos.combustible), `${fmtDec1(inp.combustible_lp100)} L/100km`);
  }

  // 4. Gomas rotas/dañadas
  push("gomas", descuentoGomas(porMes(inp.gomas), c.tramos.gomas), eventosTxt(inp.gomas, meses));

  // 5. Roturas varias (por mal uso) — leves vs graves según el campo `gravedad`.
  push(
    "roturas_varias",
    descuentoRoturasVarias(porMes(inp.roturas_leves), porMes(inp.roturas_graves), c.tramos.roturas_varias),
    eventosTxt(inp.roturas_leves + inp.roturas_graves, meses),
  );

  // 7. Seguridad (actas/apercibimientos + multas)
  push("seguridad", descuentoSeguridad(porMes(inp.seguridad), c.tramos.seguridad), eventosTxt(inp.seguridad, meses));

  // 8. Accidentes/siniestros con responsabilidad
  push("siniestros", descuentoSiniestros(porMes(inp.siniestros), c.tramos.siniestros), eventosTxt(inp.siniestros, meses));

  // 9. Conducta laboral
  push("conducta", descuentoConducta(porMes(inp.conducta), c.tramos.conducta), eventosTxt(inp.conducta, meses));

  const base = conceptos.reduce((s, x) => s + x.tope, 0);
  const totalDesc = conceptos.reduce((s, x) => s + x.descuento, 0);
  const score = Math.max(0, Math.min(100, base - totalDesc));

  const desglose: ScoreDesglose[] = conceptos
    .filter((x) => x.descuento > 0)
    .map((x) => ({ label: `${x.label} · ${x.detalle}`, puntos: -x.descuento }));

  return { score, desglose, conceptos };
}
