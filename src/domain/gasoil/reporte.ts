/**
 * El reporte de autoconsumo: todo lo que hay que calcular para armarlo.
 *
 * Vive acá y no en `actions.ts` por dos motivos. El primero es la regla de la
 * casa: un módulo `"use server"` sólo puede exportar funciones async, así que los
 * tipos que la pantalla importa tienen que vivir afuera. El segundo es que estas
 * cuentas son las que después se le presentan a YPF y se cruzan contra el reporte
 * que ellos mandan — conviene poder probarlas sin base de datos.
 *
 * La consigna que atraviesa todo el archivo: **lo que falta se muestra como que
 * falta**. Un `0` litros cargados es una afirmación ("nadie cargó nada") y un
 * `null` es otra ("no lo sabemos"). Confundirlas en un papel que sale de la
 * empresa es la diferencia entre un desvío del −100 % y una celda vacía.
 */

// ── Lo que entra ─────────────────────────────────────────────────────────────

/** Una vuelta autorizada, ya resuelta a nombres y con la fecha en hora argentina. */
export type AutorizacionCruda = {
  id: string;
  /** "YYYY-MM-DD" en hora de Argentina. */
  fecha: string;
  /** "HH:MM" en hora de Argentina. */
  hora: string;
  chofer: string | null;
  cantera: string;
  destino: string;
  toneladas: number;
  litrosPorTonelada: number;
  litros: number;
  observaciones: string | null;
};

/** Una carga de gasoil en el surtidor. */
export type CargaCruda = {
  /** "YYYY-MM-DD" en hora de Argentina. */
  fecha: string;
  litros: number;
};

// ── Lo que sale ──────────────────────────────────────────────────────────────

export type LineaReporte = {
  cantera: string;
  destino: string;
  vueltas: number;
  toneladas: number;
  /**
   * El rinde de la línea. Si todas las vueltas del tramo se autorizaron con el
   * mismo coeficiente es ese; si en el medio se cambió la tarifa, es el promedio
   * ponderado y `rindeMixto` queda en `true` para que el papel lo aclare.
   */
  litrosPorTonelada: number;
  rindeMixto: boolean;
  litrosTeoricos: number;
};

/** Una cantera con sus destinos abajo, como el árbol del reporte de YPF. */
export type CanteraGrupo = {
  cantera: string;
  vueltas: number;
  toneladas: number;
  litrosTeoricos: number;
  destinos: LineaReporte[];
};

export type LineaChofer = {
  chofer: string;
  vueltas: number;
  toneladas: number;
  litrosTeoricos: number;
  /** Promedio ponderado del tramo que hizo. */
  litrosPorTonelada: number;
};

export type DiaSerie = {
  /** "YYYY-MM-DD". */
  fecha: string;
  /** Día del mes, 1..31. */
  dia: number;
  vueltas: number;
  toneladas: number;
  litrosTeoricos: number;
  /** `null` sólo cuando el mes entero no tiene ninguna carga registrada. */
  litrosCargados: number | null;
  acumTeoricos: number;
  acumCargados: number | null;
};

export type Desvio = {
  /** Cargado − teórico. Negativo = se cargó menos de lo que correspondía. */
  litros: number;
  /** Sobre el teórico. `null` si el teórico es cero (no se divide por cero). */
  pct: number | null;
};

/** Los totales del mes, sin nada del detalle. Es lo que se compara mes a mes. */
export type TotalesMes = {
  vueltas: number;
  toneladas: number;
  litrosTeoricos: number;
  litrosCargados: number | null;
  cargas: number;
};

// ── Fechas ───────────────────────────────────────────────────────────────────

const TZ = "America/Argentina/Buenos_Aires";

/**
 * La fecha y la hora argentinas de un instante.
 *
 * Los `timestamptz` vuelven en UTC y el server corre en UTC: una autorización de
 * las 22:30 del 31 de agosto se guarda como 1 de septiembre. Agrupar por el día
 * crudo le pone al reporte de septiembre una vuelta que en la planilla de la
 * oficina figura en agosto.
 */
export function partesArgentinas(instante: string | Date): { fecha: string; hora: string } {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return { fecha: "", hora: "" };
  const fecha = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { fecha, hora };
}

/**
 * Los bordes del mes, escritos con el huso argentino adentro.
 *
 * Sin el `-03:00` explícito, Postgres lee `'2026-09-01'` como medianoche UTC y el
 * mes queda corrido tres horas: entran las vueltas del 31 de agosto a la noche y
 * se caen las del 30 de septiembre después de las 21. Argentina no tiene horario
 * de verano desde 2009, así que el offset es fijo y no hace falta una tabla.
 */
export function bordesDelMesAr(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const sigY = m === 12 ? y! + 1 : y!;
  const sigM = m === 12 ? 1 : m! + 1;
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    desde: `${y}-${dos(m!)}-01T00:00:00-03:00`,
    hasta: `${sigY}-${dos(sigM)}-01T00:00:00-03:00`,
  };
}

/** El mes anterior a "YYYY-MM". */
export function mesAnterior(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const prevY = m === 1 ? y! - 1 : y!;
  const prevM = m === 1 ? 12 : m! - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

/** Cuántos días tiene el mes "YYYY-MM". */
export function diasDelMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

// ── Agrupaciones ─────────────────────────────────────────────────────────────

/** Suma con dos decimales, para que la suma de litros no arrastre ruido binario. */
const red2 = (n: number) => Math.round(n * 100) / 100;

/**
 * El cuadro por tramo: una línea por cantera → destino.
 *
 * El rinde no se toma de la primera fila que aparezca. Cada autorización guarda
 * su coeficiente congelado, así que si a mitad de mes se corrigió la tarifa, en
 * el mismo tramo conviven dos. Se muestra el promedio ponderado y se marca el
 * tramo como mixto: el que recibe el papel tiene que poder ver que ese 26,88 no
 * es un número que se aplicó parejo.
 */
export function agruparPorTramo(autorizaciones: AutorizacionCruda[]): LineaReporte[] {
  const porTramo = new Map<string, LineaReporte & { rindes: Set<number> }>();

  for (const a of autorizaciones) {
    const k = `${a.cantera}|${a.destino}`;
    const prev =
      porTramo.get(k) ??
      ({
        cantera: a.cantera,
        destino: a.destino,
        vueltas: 0,
        toneladas: 0,
        litrosPorTonelada: 0,
        rindeMixto: false,
        litrosTeoricos: 0,
        rindes: new Set<number>(),
      } as LineaReporte & { rindes: Set<number> });
    prev.vueltas += 1;
    prev.toneladas = red2(prev.toneladas + a.toneladas);
    prev.litrosTeoricos = red2(prev.litrosTeoricos + a.litros);
    prev.rindes.add(a.litrosPorTonelada);
    porTramo.set(k, prev);
  }

  return [...porTramo.values()]
    .map(({ rindes, ...l }) => ({
      ...l,
      rindeMixto: rindes.size > 1,
      litrosPorTonelada:
        rindes.size === 1
          ? [...rindes][0]!
          : l.toneladas > 0
            ? l.litrosTeoricos / l.toneladas
            : 0,
    }))
    .sort(
      (a, b) =>
        a.cantera.localeCompare(b.cantera, "es") || a.destino.localeCompare(b.destino, "es"),
    );
}

/** Las mismas líneas, colgadas de su cantera y con el subtotal de cada una. */
export function agruparPorCantera(lineas: LineaReporte[]): CanteraGrupo[] {
  const porCantera = new Map<string, CanteraGrupo>();
  for (const l of lineas) {
    const prev =
      porCantera.get(l.cantera) ??
      { cantera: l.cantera, vueltas: 0, toneladas: 0, litrosTeoricos: 0, destinos: [] };
    prev.vueltas += l.vueltas;
    prev.toneladas = red2(prev.toneladas + l.toneladas);
    prev.litrosTeoricos = red2(prev.litrosTeoricos + l.litrosTeoricos);
    prev.destinos.push(l);
    porCantera.set(l.cantera, prev);
  }
  return [...porCantera.values()].sort((a, b) => b.litrosTeoricos - a.litrosTeoricos);
}

/**
 * Cuánto le tocó a cada chofer.
 *
 * Es el corte que YPF no puede hacer —ellos ven la tarjeta, no el legajo— y es
 * exactamente el que sirve para explicar un desvío: si faltan mil litros, la
 * pregunta siguiente es de quién.
 */
export function agruparPorChofer(autorizaciones: AutorizacionCruda[]): LineaChofer[] {
  const porChofer = new Map<string, LineaChofer>();
  for (const a of autorizaciones) {
    const nombre = a.chofer ?? "Sin chofer asignado";
    const prev =
      porChofer.get(nombre) ??
      { chofer: nombre, vueltas: 0, toneladas: 0, litrosTeoricos: 0, litrosPorTonelada: 0 };
    prev.vueltas += 1;
    prev.toneladas = red2(prev.toneladas + a.toneladas);
    prev.litrosTeoricos = red2(prev.litrosTeoricos + a.litros);
    porChofer.set(nombre, prev);
  }
  return [...porChofer.values()]
    .map((c) => ({
      ...c,
      litrosPorTonelada: c.toneladas > 0 ? c.litrosTeoricos / c.toneladas : 0,
    }))
    .sort((a, b) => b.litrosTeoricos - a.litrosTeoricos);
}

/**
 * Día por día, con el acumulado al lado. Es la serie de los dos gráficos.
 *
 * `litrosCargados` vale `0` en un día sin cargas de un mes que sí tiene, y `null`
 * en todos los días de un mes que no tiene ninguna. La distinción es la misma de
 * siempre: un día sin cargar es un dato, un mes sin importar no lo es.
 *
 * `hastaDia` corta la serie donde termina la realidad. En el mes en curso, dibujar
 * los días que todavía no pasaron es dibujar una línea plana que parece una caída.
 */
export function serieDiaria(
  autorizaciones: AutorizacionCruda[],
  cargas: CargaCruda[],
  mes: string,
  hastaDia?: number,
): DiaSerie[] {
  const total = diasDelMes(mes);
  const ultimo = Math.min(Math.max(hastaDia ?? total, 1), total);
  const hayCargas = cargas.length > 0;

  const dias: DiaSerie[] = [];
  for (let d = 1; d <= ultimo; d++) {
    dias.push({
      fecha: `${mes}-${String(d).padStart(2, "0")}`,
      dia: d,
      vueltas: 0,
      toneladas: 0,
      litrosTeoricos: 0,
      litrosCargados: hayCargas ? 0 : null,
      acumTeoricos: 0,
      acumCargados: hayCargas ? 0 : null,
    });
  }

  const indice = new Map(dias.map((d) => [d.fecha, d]));

  for (const a of autorizaciones) {
    const d = indice.get(a.fecha);
    if (!d) continue;
    d.vueltas += 1;
    d.toneladas = red2(d.toneladas + a.toneladas);
    d.litrosTeoricos = red2(d.litrosTeoricos + a.litros);
  }
  for (const c of cargas) {
    const d = indice.get(c.fecha);
    if (!d) continue;
    d.litrosCargados = red2((d.litrosCargados ?? 0) + c.litros);
  }

  let accT = 0;
  let accC = 0;
  for (const d of dias) {
    accT = red2(accT + d.litrosTeoricos);
    d.acumTeoricos = accT;
    if (hayCargas) {
      accC = red2(accC + (d.litrosCargados ?? 0));
      d.acumCargados = accC;
    }
  }

  return dias;
}

// ── Totales y desvío ─────────────────────────────────────────────────────────

export function totales(
  autorizaciones: AutorizacionCruda[],
  cargas: CargaCruda[],
): TotalesMes {
  return {
    vueltas: autorizaciones.length,
    toneladas: red2(autorizaciones.reduce((a, x) => a + x.toneladas, 0)),
    litrosTeoricos: red2(autorizaciones.reduce((a, x) => a + x.litros, 0)),
    // Cero cargas no es cero litros: es que todavía no se importó el reporte.
    litrosCargados: cargas.length === 0 ? null : red2(cargas.reduce((a, c) => a + c.litros, 0)),
    cargas: cargas.length,
  };
}

/** El desvío. `null` cuando no hay con qué compararlo. */
export function calcularDesvio(
  litrosTeoricos: number,
  litrosCargados: number | null,
): Desvio | null {
  if (litrosCargados == null) return null;
  const litros = red2(litrosCargados - litrosTeoricos);
  return { litros, pct: litrosTeoricos === 0 ? null : (litros / litrosTeoricos) * 100 };
}

/**
 * La variación contra el mes anterior, en porcentaje.
 *
 * `null` si el mes anterior no tiene el dato o está en cero: "subió un infinito
 * por ciento" no le sirve a nadie, y el papel prefiere no decir nada a decir eso.
 */
export function variacion(actual: number | null, previo: number | null): number | null {
  if (actual == null || previo == null || previo === 0) return null;
  return ((actual - previo) / previo) * 100;
}

// ── El reporte entero ────────────────────────────────────────────────────────

export type ReporteAutoconsumo = {
  mes: string;
  /** Cuántos días tiene el mes. */
  dias: number;
  /** Hasta qué día hay realidad: el mes entero, o el día de hoy si está en curso. */
  hastaDia: number;
  esMesEnCurso: boolean;
  lineas: LineaReporte[];
  canteras: CanteraGrupo[];
  choferes: LineaChofer[];
  /** El detalle, una fila por vuelta, ordenado por fecha. */
  autorizaciones: AutorizacionCruda[];
  serie: DiaSerie[];
  totales: TotalesMes;
  desvio: Desvio | null;
  /** Litros teóricos por tonelada movida en el mes. `null` si no se movió nada. */
  rindePromedio: number | null;
  /** Los mismos totales del mes anterior, para poner el mes en contexto. */
  previo: TotalesMes | null;
  /** Algún tramo mezcla dos rindes distintos: el papel tiene que aclararlo. */
  hayRindeMixto: boolean;
};

/**
 * Arma el reporte completo a partir de las filas crudas.
 *
 * Está separado de la consulta a propósito: así el reporte que se le presenta a
 * YPF se puede probar con un fixture, que es lo único que garantiza que el día
 * que alguien toque una cuenta los números sigan cruzando con los de ellos.
 */
export function armarReporte(input: {
  mes: string;
  autorizaciones: AutorizacionCruda[];
  cargas: CargaCruda[];
  previo?: TotalesMes | null;
  /** "YYYY-MM-DD" de hoy en Argentina. Define hasta dónde llega la serie. */
  hoy: string;
}): ReporteAutoconsumo {
  const { mes, autorizaciones, cargas, hoy } = input;
  const dias = diasDelMes(mes);
  const esMesEnCurso = hoy.slice(0, 7) === mes;
  // Un mes futuro no tiene ni un día de realidad; uno pasado los tiene todos.
  const hastaDia = esMesEnCurso ? Number(hoy.slice(8, 10)) : hoy.slice(0, 7) < mes ? 1 : dias;

  const ordenadas = [...autorizaciones].sort(
    (a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora) || a.id.localeCompare(b.id),
  );
  const lineas = agruparPorTramo(ordenadas);
  const t = totales(ordenadas, cargas);

  return {
    mes,
    dias,
    hastaDia,
    esMesEnCurso,
    lineas,
    canteras: agruparPorCantera(lineas),
    choferes: agruparPorChofer(ordenadas),
    autorizaciones: ordenadas,
    serie: serieDiaria(ordenadas, cargas, mes, hastaDia),
    totales: t,
    desvio: calcularDesvio(t.litrosTeoricos, t.litrosCargados),
    rindePromedio: t.toneladas > 0 ? t.litrosTeoricos / t.toneladas : null,
    previo: input.previo ?? null,
    hayRindeMixto: lineas.some((l) => l.rindeMixto),
  };
}
