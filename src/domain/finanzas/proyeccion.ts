/**
 * Proyección financiera: qué meses vienen apretados.
 *
 * Pedido de Bárbara, dos audios del 30/07/2026:
 *   "Que el sistema detecte en el área de préstamos y eso los baches
 *   financieros. […] Que me empiece a decir: che, alerta, alerta, alerta."
 *   "Che, fijate que en septiembre te las vas a ver negras, porque la
 *   facturación viene siendo relativamente baja. Se te juntaron un montón de
 *   préstamos, un montón de cheques. Tenés seis choferes de vacaciones la
 *   semana anterior, por ende tenés seis camiones sin facturar."
 *
 * Dos decisiones que explican la forma de este archivo:
 *
 * 1. NOSOTROS NO DEFINIMOS QUÉ ES UN MES COMPLICADO. El umbral lo ponen ellos
 *    (decisión de Julián, 14/08). Sin tope configurado no hay alerta: nunca se
 *    inventa uno "razonable". Es el mismo criterio del tope de préstamos, que
 *    Bárbara ya usa y entendió.
 *
 * 2. EL TOTAL DICE DE QUÉ ESTÁ HECHO. Ella misma puso el límite: "para eso
 *    tendríamos que cargar absolutamente todos y cada uno de los costos, lo
 *    cual por el momento no va a suceder". Entonces el número SIEMPRE subestima,
 *    y un número que subestima sin avisar es peor que no tenerlo: la alerta no
 *    salta y nadie sabe por qué. Por eso cada mes viene con el desglose por
 *    fuente y su `cobertura`, y con la lista de `huecos`.
 *
 * Funciones puras, sin base y sin `server-only`: las usan la caja, el
 * dashboard, préstamos y el generador de alertas. Una sola cuenta para las
 * cuatro superficies, así no pueden contradecirse.
 */

import { excedeTope, type Exceso, type Nivel } from "@/app/(dashboard)/prestamos/topes";

/** De dónde sale cada peso comprometido de un mes. */
export type FuenteEgreso = "prestamos" | "cheques" | "sueldos" | "impuestos";

export const FUENTE_LABEL: Record<FuenteEgreso, string> = {
  prestamos: "Cuotas de préstamos",
  cheques: "Cheques nuestros",
  sueldos: "Sueldos",
  impuestos: "Impuestos",
};

/**
 * Qué tan completo está lo que sabemos de una fuente.
 *
 *  · `firme`     — está todo lo que tiene que estar (préstamos tiene los 53
 *                  cargados con su cronograma; los cheques propios se cargan a
 *                  mano uno por uno).
 *  · `parcial`   — hay datos pero se sabe que faltan. Impuestos son 11 cargados
 *                  sin que esté definido el set completo, y de sueldos sólo
 *                  entra la planilla de administración y taller: la liquidación
 *                  de choferes se hace fuera del sistema.
 *  · `sin_datos` — el mes no tiene NADA de esa fuente. No es lo mismo que cero:
 *                  cero es "no se paga nada", esto es "no lo sabemos".
 */
export type Cobertura = "firme" | "parcial" | "sin_datos";

export type AporteMes = {
  fuente: FuenteEgreso;
  monto: number;
  /** Cuántos ítems lo componen: 3 cuotas, 2 cheques. Es lo que hace auditable el total. */
  items: number;
  cobertura: Cobertura;
};

/** Un compromiso de pago, ya normalizado por quien lo trae de la base. */
export type Compromiso = {
  fuente: FuenteEgreso;
  /** Cuándo se paga, en ISO. Si cae en día inhábil, ya viene corrida. */
  fecha: string;
  monto: number;
};

/** Lo facturado de un mes cerrado, para poder proyectar los que vienen. */
export type FacturacionMes = { mes: string; monto: number };

export type BaseFacturacion =
  | { metodo: "promedio"; meses: number }
  | { metodo: "sin_historico" };

export type MesProyectado = {
  /** "2026-09" */
  mes: string;
  aportes: AporteMes[];
  /** Todo lo comprometido que sabemos. SIEMPRE es un piso, nunca el total real. */
  totalEgresos: number;
  /** Sólo lo que viene de fuentes completas. Es el número en el que se puede confiar. */
  totalFirme: number;
  facturacionProyectada: number | null;
  baseFacturacion: BaseFacturacion;
  /** Personas que no están ese mes: son camiones que no facturan. */
  ausentes: number;
  nivel: Nivel;
  exceso: Exceso | null;
  /** Por qué saltó: el tope en pesos, el % de la facturación, o ninguno. */
  motivo: MotivoAlerta | null;
  /** Fuentes que no aportan lo que deberían. Si no está vacío, el total subestima. */
  huecos: FuenteEgreso[];
};

export type MotivoAlerta = "tope_pesos" | "pct_facturacion";

// ── Configuración (la ponen ellos) ───────────────────────────────────────────

export const TOPES_FINANZAS_CLAVE = "finanzas_topes";

export type TopesFinanzas = {
  /** Avisar si los egresos comprometidos del mes superan estos pesos. */
  egresosMes: number | null;
  /** Avisar si los egresos se comen más de este % de la facturación proyectada. */
  pctFacturacion: number | null;
  /** Cuántos meses cerrados se promedian para proyectar la facturación. */
  mesesPromedio: number;
};

/** Sin tope no hay alerta. El promedio arranca en 3 porque es lo que se puede cambiar sin romper nada. */
export const TOPES_FINANZAS_DEFAULT: TopesFinanzas = {
  egresosMes: null,
  pctFacturacion: null,
  mesesPromedio: 3,
};

function limpiarPesos(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  // Un tope en cero no es "avisar siempre": es "sin tope". Igual que en préstamos.
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function limpiarPct(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  // Más de 100% es un mes en el que se paga más de lo que entra: es un umbral
  // válido, aunque raro. Arriba de 1000 es un dedo que se resbaló.
  return Math.min(1000, Math.round(n));
}

function limpiarMeses(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return TOPES_FINANZAS_DEFAULT.mesesPromedio;
  return Math.min(24, Math.max(1, Math.round(n)));
}

/** Normaliza lo que venga de la base o del formulario. */
export function mergeTopesFinanzas(raw: unknown): TopesFinanzas {
  if (!raw || typeof raw !== "object") return { ...TOPES_FINANZAS_DEFAULT };
  const o = raw as Record<string, unknown>;
  return {
    egresosMes: limpiarPesos(o.egresosMes),
    pctFacturacion: limpiarPct(o.pctFacturacion),
    mesesPromedio: limpiarMeses(o.mesesPromedio),
  };
}

export function hayAlgunTopeFinanzas(t: TopesFinanzas): boolean {
  return t.egresosMes != null || t.pctFacturacion != null;
}

// ── Meses ────────────────────────────────────────────────────────────────────

/** "2026-09-04" → "2026-09". */
export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7);
}

/** Suma meses a un "YYYY-MM" sin pasar por Date (que se come el huso). */
export function sumarMes(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = (y ?? 0) * 12 + (m ?? 1) - 1 + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Los meses de `desde` a `hasta`, ambos incluidos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let m = desde; m <= hasta; m = sumarMes(m, 1)) {
    out.push(m);
    if (out.length > 240) break; // 20 años: no hay proyección que valga más
  }
  return out;
}

// ── Facturación proyectada ───────────────────────────────────────────────────

/**
 * Con qué número se compara. Es el promedio de los últimos meses CERRADOS,
 * que es lo más honesto que se puede hacer con lo que hay: los viajes del mes
 * en curso todavía se están cargando, así que meterlo tira el promedio abajo y
 * hace saltar la alerta por un mes incompleto, no por un mes malo.
 *
 * Devuelve null si no hay historial: sin base no se inventa una proyección.
 */
export function proyectarFacturacion(
  historico: FacturacionMes[],
  mesActual: string,
  mesesPromedio: number,
): { monto: number | null; base: BaseFacturacion } {
  const cerrados = historico
    .filter((h) => h.mes < mesActual && h.monto > 0)
    .sort((a, b) => (a.mes < b.mes ? 1 : -1))
    .slice(0, Math.max(1, mesesPromedio));

  if (cerrados.length === 0) return { monto: null, base: { metodo: "sin_historico" } };

  const suma = cerrados.reduce((a, h) => a + h.monto, 0);
  return {
    monto: Math.round(suma / cerrados.length),
    base: { metodo: "promedio", meses: cerrados.length },
  };
}

// ── Evaluación ───────────────────────────────────────────────────────────────

/**
 * Si el mes cruza alguno de los topes configurados. Gana el que da el exceso
 * más grande, para que el aviso hable del problema mayor y no del primero de
 * la lista.
 */
export function evaluarMes(
  totalEgresos: number,
  facturacionProyectada: number | null,
  topes: TopesFinanzas,
): { nivel: Nivel; exceso: Exceso | null; motivo: MotivoAlerta | null } {
  const porPesos = excedeTope(totalEgresos, topes.egresosMes);

  // El tope por porcentaje se traduce a pesos contra la facturación proyectada:
  // "avisame si los egresos superan el 70% de lo que voy a facturar".
  const topePct =
    topes.pctFacturacion != null && facturacionProyectada != null && facturacionProyectada > 0
      ? (facturacionProyectada * topes.pctFacturacion) / 100
      : null;
  const porPct = excedeTope(totalEgresos, topePct);

  const candidatos: { exceso: Exceso; motivo: MotivoAlerta }[] = [];
  if (porPesos) candidatos.push({ exceso: porPesos, motivo: "tope_pesos" });
  if (porPct) candidatos.push({ exceso: porPct, motivo: "pct_facturacion" });

  if (candidatos.length === 0) return { nivel: "ok", exceso: null, motivo: null };

  const peor = candidatos.reduce((a, b) => (b.exceso.exceso > a.exceso.exceso ? b : a));
  return { nivel: "excedido", exceso: peor.exceso, motivo: peor.motivo };
}

// ── Armado ───────────────────────────────────────────────────────────────────

export type ProyeccionInput = {
  /** Todo lo comprometido de acá en adelante, de las cuatro fuentes. */
  compromisos: Compromiso[];
  /** Lo facturado por mes, para promediar. */
  historicoFacturacion: FacturacionMes[];
  /** Cuánta gente falta cada mes (vacaciones + días pedidos): camiones que no facturan. */
  ausentesPorMes: Record<string, number>;
  /** Qué tan completa está cada fuente HOY. Lo decide quien trae los datos. */
  cobertura: Record<FuenteEgreso, Cobertura>;
  topes: TopesFinanzas;
  /** "2026-08". Todo lo anterior no se proyecta. */
  mesActual: string;
  /** Cuántos meses hacia adelante. */
  meses: number;
};

/**
 * La proyección completa, mes a mes. Es la única función que hace la cuenta:
 * la caja, el dashboard, préstamos y las alertas consumen esto.
 */
export function construirProyeccion(input: ProyeccionInput): MesProyectado[] {
  const hasta = sumarMes(input.mesActual, Math.max(0, input.meses - 1));

  return mesesEntre(input.mesActual, hasta).map((mes) => {
    const delMes = input.compromisos.filter((c) => mesDe(c.fecha) === mes);

    const aportes: AporteMes[] = (Object.keys(FUENTE_LABEL) as FuenteEgreso[]).map((fuente) => {
      const items = delMes.filter((c) => c.fuente === fuente);
      const monto = items.reduce((a, c) => a + c.monto, 0);
      const declarada = input.cobertura[fuente] ?? "sin_datos";
      return {
        fuente,
        monto,
        items: items.length,
        // Una fuente declarada firme que no trajo NADA para el mes sigue siendo
        // un dato ("ese mes no se paga nada"), no un hueco. La que no está
        // cargada en el sistema es la que deja el total corto.
        cobertura: items.length === 0 && declarada !== "firme" ? "sin_datos" : declarada,
      };
    });

    const totalEgresos = aportes.reduce((a, x) => a + x.monto, 0);
    const totalFirme = aportes
      .filter((x) => x.cobertura === "firme")
      .reduce((a, x) => a + x.monto, 0);
    const huecos = aportes.filter((x) => x.cobertura !== "firme").map((x) => x.fuente);

    const { monto: facturacionProyectada, base } = proyectarFacturacion(
      input.historicoFacturacion,
      input.mesActual,
      input.topes.mesesPromedio,
    );

    const { nivel, exceso, motivo } = evaluarMes(totalEgresos, facturacionProyectada, input.topes);

    return {
      mes,
      aportes,
      totalEgresos,
      totalFirme,
      facturacionProyectada,
      baseFacturacion: base,
      ausentes: input.ausentesPorMes[mes] ?? 0,
      nivel,
      exceso,
      motivo,
      huecos,
    };
  });
}

/**
 * El primer mes que se pasa. Es lo que mira el dashboard y lo que dispara la
 * alerta: si hay tres meses complicados, el que importa es el más cercano.
 */
export function primerMesComplicado(proyeccion: MesProyectado[]): MesProyectado | null {
  return proyeccion.find((m) => m.nivel === "excedido") ?? null;
}
