/**
 * Feriados argentinos y días hábiles bancarios.
 *
 * Pensado para todo el sistema, no sólo para préstamos: cualquier lugar donde
 * haya que preguntar "¿este día se puede pagar / presentar / trabajar?".
 *
 * Por qué no alcanza con bajar una API una vez al año:
 *
 * 1. La Ley 27.399 es un ALGORITMO. Los feriados inamovibles son fechas fijas,
 *    Carnaval y Semana Santa se derivan de Pascua, y los cuatro trasladables
 *    siguen una regla explícita (art. 6). O sea que 16 de los ~19 días de
 *    CUALQUIER año se calculan acá, sin red, para siempre.
 * 2. Lo único que no se puede calcular son los días no laborables con fines
 *    turísticos (los "puentes"), que el Poder Ejecutivo fija año a año por
 *    decreto, y que se publican recién entre fines de noviembre y fines de
 *    diciembre del año anterior. Ésos se cargan a mano.
 * 3. Las APIs públicas mienten en los años futuros: la más usada devuelve 2027
 *    con los trasladables SIN trasladar y con HTTP 200 — el peor modo de falla,
 *    porque no avisa. Por eso el calendario vive en nuestra tabla y la API sólo
 *    se usa para AVISAR de diferencias, nunca para escribir sola.
 *
 * Y para bancos hay tres cosas que ninguna API de feriados nacionales trae:
 *
 * - Los DÍAS NO LABORABLES cierran los bancos igual. No es una interpretación:
 *   el art. 167 de la LCT dice que el trabajo es optativo para el empleador
 *   "salvo en bancos, seguros y actividades afines".
 * - El Día del Bancario (6 de noviembre) no es feriado nacional sino asueto del
 *   convenio de la actividad, y las sucursales no abren.
 * - El Jueves Santo es día no laborable y los bancos tampoco atienden.
 *
 * La regla de corrimiento es una sola y no tiene excepciones: si un vencimiento
 * cae en día inhábil, se paga el primer día hábil SIGUIENTE. Está en los
 * contratos alineados a la Com. "A" 7199 del BCRA, en el criterio de débito
 * automático de ARCA y en el art. 6 del Código Civil y Comercial.
 */

export type TipoFeriado =
  /** Fecha fija de la Ley 27.399 (1/1, 25/5, 9/7…). */
  | "inamovible"
  /** Los cuatro que se corren al lunes según el art. 6 (Güemes, San Martín…). */
  | "trasladable"
  /** "Puente": lo fija el Ejecutivo cada año y no se puede calcular. */
  | "turistico"
  /** Día no laborable (Jueves Santo, religiosos): optativo salvo para bancos. */
  | "no_laborable"
  /** Asueto de la actividad bancaria (6/11) o del BCRA (24 y 31/12). */
  | "bancario"
  /** Declarado fuera de calendario (censo, un DNU, una fecha puntual). */
  | "extraordinario";

export type Feriado = {
  /** YYYY-MM-DD. */
  fecha: string;
  nombre: string;
  tipo: TipoFeriado;
  /**
   * true = feriado pleno (descanso obligatorio, se paga con recargo).
   * false = día no laborable: la actividad la decide el empleador. La
   * diferencia es plata en la liquidación del chofer, por eso no es un solo
   * booleano con "es_feriado".
   */
  es_feriado: boolean;
  /**
   * ¿Cierran los bancos ese día? Los no laborables y los asuetos bancarios
   * cierran aunque no sean feriado.
   */
  cierra_banco: boolean;
};

/* ------------------------------------------------------------------ *
 * Utilidades de fecha civil (sin UTC: las fechas de acá son días del
 * calendario, no instantes, y mezclarlo con zonas horarias ya nos corrió
 * fechas antes).
 * ------------------------------------------------------------------ */

export function aISO(y: number, mes1a12: number, dia: number): string {
  return `${y}-${String(mes1a12).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function desdeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function fechaAISO(d: Date): string {
  return aISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Suma (o resta) días a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const d = desdeISO(iso);
  d.setDate(d.getDate() + dias);
  return fechaAISO(d);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(iso: string): number {
  return desdeISO(iso).getDay();
}

export function esFinDeSemana(iso: string): boolean {
  const d = diaSemana(iso);
  return d === 0 || d === 6;
}

/**
 * Domingo de Pascua del año, por el algoritmo de Meeus/Butcher (gregoriano).
 * De acá salen Carnaval, Jueves Santo y Viernes Santo.
 */
export function pascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return aISO(anio, mes, dia);
}

/* ------------------------------------------------------------------ *
 * Ley 27.399
 * ------------------------------------------------------------------ */

/** Fechas fijas del art. 1. */
const INAMOVIBLES: { mes: number; dia: number; nombre: string }[] = [
  { mes: 1, dia: 1, nombre: "Año Nuevo" },
  { mes: 3, dia: 24, nombre: "Día Nacional de la Memoria por la Verdad y la Justicia" },
  { mes: 4, dia: 2, nombre: "Día del Veterano y de los Caídos en la Guerra de Malvinas" },
  { mes: 5, dia: 1, nombre: "Día del Trabajador" },
  { mes: 5, dia: 25, nombre: "Día de la Revolución de Mayo" },
  { mes: 6, dia: 20, nombre: "Paso a la Inmortalidad del General Manuel Belgrano" },
  { mes: 7, dia: 9, nombre: "Día de la Independencia" },
  { mes: 12, dia: 8, nombre: "Inmaculada Concepción de María" },
  { mes: 12, dia: 25, nombre: "Navidad" },
];

/** Los cuatro del art. 2, con su fecha nominal antes del traslado. */
const TRASLADABLES: { mes: number; dia: number; nombre: string }[] = [
  { mes: 6, dia: 17, nombre: "Paso a la Inmortalidad del General Martín Miguel de Güemes" },
  { mes: 8, dia: 17, nombre: "Paso a la Inmortalidad del General José de San Martín" },
  { mes: 10, dia: 12, nombre: "Día del Respeto a la Diversidad Cultural" },
  { mes: 11, dia: 20, nombre: "Día de la Soberanía Nacional" },
];

/**
 * Art. 6: martes y miércoles se corren al lunes ANTERIOR; jueves y viernes, al
 * lunes SIGUIENTE. El lunes queda donde está.
 *
 * Sábado y domingo quedaron sin regla en la ley y el Decreto 614/2025 los dejó a
 * criterio de Jefatura de Gabinete (puede ir al lunes siguiente o al viernes
 * anterior). Como es discrecional, acá se devuelve la fecha nominal marcada como
 * `pendiente`, para que la pantalla lo diga en vez de inventar una fecha.
 */
export function trasladar(iso: string): { fecha: string; pendiente: boolean } {
  switch (diaSemana(iso)) {
    case 2: // martes
      return { fecha: sumarDias(iso, -1), pendiente: false };
    case 3: // miércoles
      return { fecha: sumarDias(iso, -2), pendiente: false };
    case 4: // jueves
      return { fecha: sumarDias(iso, 4), pendiente: false };
    case 5: // viernes
      return { fecha: sumarDias(iso, 3), pendiente: false };
    case 0: // domingo
    case 6: // sábado
      return { fecha: iso, pendiente: true };
    default: // lunes
      return { fecha: iso, pendiente: false };
  }
}

export type FeriadoGenerado = Feriado & {
  /** El traslado depende de una decisión que todavía no se tomó (sáb/dom). */
  pendiente?: boolean;
  /** Fecha nominal, cuando se trasladó. */
  fecha_nominal?: string;
};

/**
 * Todo lo que la ley permite calcular para un año, sin red y sin base de datos.
 * NO incluye los días no laborables con fines turísticos: ésos se fijan por
 * decreto año a año y hay que cargarlos.
 */
export function generarFeriadosLey(anio: number): FeriadoGenerado[] {
  const out: FeriadoGenerado[] = [];
  const base = { es_feriado: true, cierra_banco: true } as const;

  for (const f of INAMOVIBLES) {
    out.push({ fecha: aISO(anio, f.mes, f.dia), nombre: f.nombre, tipo: "inamovible", ...base });
  }

  // Carnaval y Semana Santa salen de Pascua.
  const dp = pascua(anio);
  out.push({ fecha: sumarDias(dp, -48), nombre: "Carnaval", tipo: "inamovible", ...base });
  out.push({ fecha: sumarDias(dp, -47), nombre: "Carnaval", tipo: "inamovible", ...base });
  out.push({ fecha: sumarDias(dp, -2), nombre: "Viernes Santo", tipo: "inamovible", ...base });
  // Jueves Santo NO es feriado: es día no laborable. Pero los bancos cierran.
  out.push({
    fecha: sumarDias(dp, -3),
    nombre: "Jueves Santo",
    tipo: "no_laborable",
    es_feriado: false,
    cierra_banco: true,
  });

  for (const f of TRASLADABLES) {
    const nominal = aISO(anio, f.mes, f.dia);
    const { fecha, pendiente } = trasladar(nominal);
    out.push({
      fecha,
      nombre: f.nombre,
      tipo: "trasladable",
      ...base,
      ...(pendiente ? { pendiente } : {}),
      ...(fecha !== nominal ? { fecha_nominal: nominal } : {}),
    });
  }

  // Día del Bancario: no es feriado nacional, es asueto del convenio de la
  // actividad. No lo trae ninguna API y las sucursales no abren.
  out.push({
    fecha: aISO(anio, 11, 6),
    nombre: "Día del Bancario",
    tipo: "bancario",
    es_feriado: false,
    cierra_banco: true,
  });

  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ------------------------------------------------------------------ *
 * Días hábiles
 * ------------------------------------------------------------------ */

/** Índice por fecha, para preguntar rápido. */
export type Calendario = Map<string, Feriado>;

export function armarCalendario(feriados: readonly Feriado[]): Calendario {
  const m: Calendario = new Map();
  for (const f of feriados) {
    // Si dos cosas caen el mismo día (Malvinas y Jueves Santo en 2026), gana la
    // que cierra el banco y, entre ésas, la que además es feriado pleno.
    const previo = m.get(f.fecha);
    if (
      !previo ||
      (f.cierra_banco && !previo.cierra_banco) ||
      (f.cierra_banco === previo.cierra_banco && f.es_feriado && !previo.es_feriado)
    ) {
      m.set(f.fecha, f);
    }
  }
  return m;
}

/** ¿Se puede operar con el banco ese día? */
export function esDiaHabilBancario(iso: string, cal: Calendario): boolean {
  if (esFinDeSemana(iso)) return false;
  return !cal.get(iso)?.cierra_banco;
}

/**
 * Si la fecha cae en día inhábil, el primer día hábil SIGUIENTE. Nunca el
 * anterior: ésa es la regla en Argentina, sin excepciones.
 */
export function proximoDiaHabilBancario(iso: string, cal: Calendario): string {
  let f = iso;
  // Tope defensivo: ni el fin de año más cargado junta 15 inhábiles seguidos.
  for (let i = 0; i < 15; i++) {
    if (esDiaHabilBancario(f, cal)) return f;
    f = sumarDias(f, 1);
  }
  return f;
}

export type Corrimiento = {
  /** La fecha que figura en el contrato. */
  vencimiento: string;
  /** Cuándo se puede pagar de verdad. */
  efectiva: string;
  /** Cuántos días se corrió (0 = no se corrió). */
  dias: number;
  /** Por qué no se puede pagar ese día. */
  motivo: string | null;
};

/**
 * Qué pasa con un vencimiento: si cae en día inhábil, cuándo se paga y por qué.
 * Es la función que usa todo el sistema — vencimientos de cuotas, cheques,
 * presentaciones — para no repetir la regla en cada pantalla.
 */
export function corrimiento(iso: string, cal: Calendario): Corrimiento {
  const efectiva = proximoDiaHabilBancario(iso, cal);
  if (efectiva === iso) return { vencimiento: iso, efectiva, dias: 0, motivo: null };

  const dow = diaSemana(iso);
  const feriado = cal.get(iso);
  const motivo = feriado
    ? feriado.nombre
    : dow === 6
      ? "cae sábado"
      : dow === 0
        ? "cae domingo"
        : "día inhábil";

  return {
    vencimiento: iso,
    efectiva,
    dias: Math.round(
      (desdeISO(efectiva).getTime() - desdeISO(iso).getTime()) / 86_400_000,
    ),
    motivo,
  };
}

/** Días hábiles bancarios entre dos fechas, incluyendo ambas puntas. */
export function diasHabilesEntre(desde: string, hasta: string, cal: Calendario): number {
  if (hasta < desde) return 0;
  let n = 0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (esDiaHabilBancario(f, cal)) n++;
  }
  return n;
}
