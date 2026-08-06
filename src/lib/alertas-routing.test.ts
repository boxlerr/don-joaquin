import { describe, it, expect, afterEach, vi } from "vitest";
import { hoyArgentina } from "./fecha-ar";
import {
  OTROS_AVISOS,
  PRESTAMOS_COL,
  COLUMNAS_TODAS,
  COLUMNAS_ABIERTAS_DE_OTROS,
  HITOS_EFEMERIDE,
  HITOS_PERIODO_PRUEBA,
  ENTIDAD_TIPOS_EFEMERIDE,
  alertaColumnaDe,
  alertaClave,
  caducaAlPasar,
  efemerideEnMail,
  esAlertaPrestamo,
  esEfemeride,
  normalizarColumnas,
  tipoHabilitado,
} from "./alertas-routing";
import { seccionDeAlerta } from "./alertas-visibilidad";

/**
 * Inventario de TODO lo que hoy genera `lib/alertas.ts`, con la columna en la que
 * tiene que caer. Es el contrato entre el generador y la pantalla de
 * configuración: si se agrega un aviso nuevo allá y no se lo registra en
 * ENTIDAD_A_COLUMNA, este test lo caza acá en vez de que termine mudo dentro de
 * "Otros avisos" — que es exactamente cómo se perdieron impuestos, services,
 * cumpleaños, ausencias y el tope de préstamos.
 */
const INVENTARIO: { tipo: string; entidad_tipo: string; columna: string }[] = [
  // Documentación (se recalculan en vivo, pero el ruteo es el mismo)
  { tipo: "vencimiento_doc_camion", entidad_tipo: "camion_documentos", columna: "vencimiento_docs" },
  { tipo: "vencimiento_doc_chofer", entidad_tipo: "chofer_documentos", columna: "vencimiento_docs" },

  // Cheques
  { tipo: "vencimiento_cheque", entidad_tipo: "cheques", columna: "cheques_vencidos" },
  { tipo: "cheque_rechazado_recordatorio", entidad_tipo: "cheques", columna: "cheques_vencidos" },

  // Compliance (clientes, organismos y F931)
  { tipo: "vencimiento_compliance", entidad_tipo: "compliance:T30", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "compliance:vencido", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "organismo_compliance:T5", columna: "vencimiento_compliance" },
  { tipo: "vencimiento_compliance", entidad_tipo: "form931:vencido", columna: "vencimiento_compliance" },

  // Préstamos — confidencial, trae montos
  { tipo: "otro", entidad_tipo: "prestamo_cuota:T1", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamo_cuota:vencido", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamo_cuota:S:2026-08-03", columna: PRESTAMOS_COL },
  { tipo: "otro", entidad_tipo: "prestamos_tope_mensual", columna: PRESTAMOS_COL },

  // Finanzas
  { tipo: "otro", entidad_tipo: "impuesto:T15", columna: "impuestos" },
  { tipo: "otro", entidad_tipo: "impuesto:vencido", columna: "impuestos" },

  // Mantenimiento
  { tipo: "otro", entidad_tipo: "mantenimiento_proximo_service", columna: "mantenimiento" },
  { tipo: "otro", entidad_tipo: "insumo_precio_desactualizado", columna: "mantenimiento" },

  // RRHH — efemérides
  { tipo: "otro", entidad_tipo: "choferes_cumple", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "personal_cumple", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "choferes_aniversario", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "personal_aniversario", columna: "rrhh_eventos" },
  { tipo: "otro", entidad_tipo: "choferes_periodo_prueba", columna: "rrhh_eventos" },

  // RRHH — disponibilidad
  { tipo: "otro", entidad_tipo: "chofer_ausencia", columna: "ausencias_vacaciones" },
  { tipo: "otro", entidad_tipo: "choferes_vacaciones_saldo", columna: "ausencias_vacaciones" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alerta = (a: { tipo: string; entidad_tipo: string }) => a as any;

describe("alertaColumnaDe", () => {
  it.each(INVENTARIO)("$entidad_tipo → $columna", ({ tipo, entidad_tipo, columna }) => {
    expect(alertaColumnaDe(alerta({ tipo, entidad_tipo }))).toBe(columna);
  });

  it("ningún aviso que hoy se genera cae en 'Otros avisos'", () => {
    const huerfanos = INVENTARIO.filter(
      (a) => alertaColumnaDe(alerta(a)) === OTROS_AVISOS,
    ).map((a) => a.entidad_tipo);
    expect(huerfanos).toEqual([]);
  });

  it("todas las columnas del inventario existen en la matriz", () => {
    for (const { columna } of INVENTARIO) expect(COLUMNAS_TODAS).toContain(columna);
  });

  it("lo desconocido sí cae en 'Otros avisos' (red de seguridad, no se pierde)", () => {
    expect(alertaColumnaDe(alerta({ tipo: "otro", entidad_tipo: "algo_nuevo" }))).toBe(OTROS_AVISOS);
    expect(alertaColumnaDe(alerta({ tipo: "auditoria_cliente", entidad_tipo: "" }))).toBe(OTROS_AVISOS);
  });

  it("no confunde un entidad_tipo que arranca parecido", () => {
    expect(alertaColumnaDe(alerta({ tipo: "otro", entidad_tipo: "impuestos_otra_cosa" }))).toBe(
      OTROS_AVISOS,
    );
  });
});

describe("coherencia con la visibilidad confidencial", () => {
  it("todo lo que es de préstamos para la campana también lo es para el mail", () => {
    for (const a of INVENTARIO) {
      if (seccionDeAlerta(a) !== "prestamos") continue;
      expect(esAlertaPrestamo(a)).toBe(true);
      expect(alertaColumnaDe(alerta(a))).toBe(PRESTAMOS_COL);
    }
  });

  it("el tope mensual no se filtra por 'Otros avisos' (trae montos)", () => {
    const tope = { tipo: "otro", entidad_tipo: "prestamos_tope_mensual" };
    expect(seccionDeAlerta(tope)).toBe("prestamos");
    expect(alertaColumnaDe(alerta(tope))).toBe(PRESTAMOS_COL);
  });
});

/**
 * Efemérides: las únicas alertas que se APAGAN SOLAS cuando pasa la fecha
 * (`generarAlertas` las marca resueltas y el mail las corta igual por las
 * dudas). Si alguna quedara afuera de esta lista volvería el bug que reportó
 * Julián: el cumpleaños del 30/07 seguía llegando en agosto como "Venció el
 * 30/07/2026". Al revés — meter acá un documento o un cheque — sería peor: un
 * vencimiento que pasó SÍ hay que seguir reclamándolo.
 */
describe("esEfemeride", () => {
  const EFEMERIDES = [
    "choferes_cumple",
    "personal_cumple",
    "choferes_aniversario",
    "personal_aniversario",
    "choferes_periodo_prueba",
  ];

  it.each(EFEMERIDES)("reconoce %s", (entidad_tipo) => {
    expect(esEfemeride({ tipo: "otro", entidad_tipo })).toBe(true);
  });

  it("son exactamente las del inventario que van a 'rrhh_eventos'", () => {
    const deLaMatriz = INVENTARIO.filter((a) => a.columna === "rrhh_eventos").map(
      (a) => a.entidad_tipo,
    );
    expect(deLaMatriz.sort()).toEqual([...EFEMERIDES].sort());
  });

  it("no marca nada que se siga reclamando después de vencer", () => {
    const siguenVivas = INVENTARIO.filter((a) => a.columna !== "rrhh_eventos");
    for (const a of siguenVivas) expect(esEfemeride(a)).toBe(false);
  });

  it("no confunde un entidad_tipo que arranca parecido", () => {
    // `alertaHref` rutea por `startsWith("choferes")`: acá el match tiene que ser
    // exacto o una ausencia terminaría apagándose sola al pasar su fecha.
    expect(esEfemeride({ tipo: "otro", entidad_tipo: "choferes_vacaciones_saldo" })).toBe(false);
    expect(esEfemeride({ tipo: "otro", entidad_tipo: "chofer_ausencia" })).toBe(false);
    expect(esEfemeride({ tipo: "otro", entidad_tipo: "choferes_cumple_otra_cosa" })).toBe(false);
    expect(esEfemeride({ tipo: "otro", entidad_tipo: "personal_cumpleanios" })).toBe(false);
  });

  it("sin entidad_tipo no es efeméride", () => {
    expect(esEfemeride({ tipo: "otro" })).toBe(false);
    expect(esEfemeride({ tipo: "otro", entidad_tipo: null })).toBe(false);
  });

  it("sólo cuenta lo que se guarda como 'otro'", () => {
    expect(esEfemeride({ tipo: "vencimiento_doc_chofer", entidad_tipo: "choferes_cumple" })).toBe(
      false,
    );
  });
});

/**
 * La ausencia programada caduca igual que un cumpleaños —el aviso sirve para
 * saber que alguien NO VA A ESTAR, así que apenas arranca deja de servir— pero
 * NO es una efeméride: rutea a su propia columna y no comparte los hitos de
 * preaviso. Por eso son dos listas y no una.
 */
describe("caducaAlPasar", () => {
  it("cubre todas las efemérides", () => {
    for (const t of ENTIDAD_TIPOS_EFEMERIDE) {
      expect(caducaAlPasar({ tipo: "otro", entidad_tipo: t })).toBe(true);
    }
  });

  it("cubre la ausencia programada, que no es efeméride", () => {
    const aus = { tipo: "otro", entidad_tipo: "chofer_ausencia" };
    expect(caducaAlPasar(aus)).toBe(true);
    expect(esEfemeride(aus)).toBe(false);
    expect(alertaColumnaDe(alerta(aus))).toBe("ausencias_vacaciones");
  });

  it("NO cubre el saldo de vacaciones: hasta el 31/12 todavía se puede tomar", () => {
    expect(caducaAlPasar({ tipo: "otro", entidad_tipo: "choferes_vacaciones_saldo" })).toBe(false);
  });

  it("NO cubre nada que se siga reclamando después de vencer", () => {
    for (const a of INVENTARIO) {
      if (a.columna === "rrhh_eventos" || a.entidad_tipo === "chofer_ausencia") continue;
      expect(caducaAlPasar(a)).toBe(false);
    }
  });
});

/**
 * El corte con el que `generarAlertas()` apaga las efemérides que ya pasaron.
 *
 * Se prueba acá la fecha, no la query, porque es lo único que estuvo mal y es
 * lo que no tiene vuelta atrás: apagar de más deja el evento fuera de la
 * campana, la pantalla, el pop-up y el mail, y no se regenera nunca.
 */
describe("corte de efemérides pasadas — fecha argentina, no UTC", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a las 21:30 ART de un 30/07 el día sigue siendo el 30, no el 31", () => {
    // En UTC ya es 2026-07-31: con `toISOString()` el `.lt(fecha_vencimiento)`
    // marcaba resuelto el cumpleaños de HOY.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T00:30:00Z"));
    expect(hoyArgentina()).toBe("2026-07-30");
  });

  it("a la hora del cron (11:00 UTC = 8:00 ART) los dos días coinciden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T11:00:00Z"));
    expect(hoyArgentina()).toBe("2026-07-30");
  });
});

/**
 * La regla que pidió Julián: "se avisa con 14 días, 7 días y en el día... hasta
 * que obvio luego se vence al otro día. No tiene sentido seguir avisando un
 * aniversario". O sea: MAIL sólo en los hitos, WEB todos los días (eso lo
 * decide la pantalla, no esto), y una vez que la fecha pasó no se avisa más en
 * ningún lado.
 */
describe("efemerideEnMail", () => {
  const cumple = { entidad_tipo: "choferes_cumple" };
  const prueba = { entidad_tipo: "choferes_periodo_prueba" };

  it("una efeméride que ya pasó no sale por mail, en ningún modo", () => {
    for (const modo of ["hitos", "semana", "todo"] as const) {
      expect(efemerideEnMail(cumple, -1, modo)).toBe(false);
      expect(efemerideEnMail(cumple, -30, modo)).toBe(false);
      expect(efemerideEnMail(prueba, -1, modo)).toBe(false);
    }
  });

  it("el mail de todos los días manda sólo en los hitos", () => {
    for (const d of HITOS_EFEMERIDE) expect(efemerideEnMail(cumple, d, "hitos")).toBe(true);
    for (const d of [1, 2, 6, 8, 13, 15, 20, 30]) {
      expect(efemerideEnMail(cumple, d, "hitos")).toBe(false);
    }
  });

  it("el resumen del lunes suma la semana que arranca, no los 30 días", () => {
    for (const d of [0, 1, 2, 5, 7]) expect(efemerideEnMail(cumple, d, "semana")).toBe(true);
    // A 20 o 29 días no hay nada que organizar: vuelve solo en su hito de 14.
    for (const d of [8, 13, 20, 29]) expect(efemerideEnMail(cumple, d, "semana")).toBe(false);
    // Un hito que cae lunes no se pierde por estar fuera de la semana.
    expect(efemerideEnMail(cumple, 14, "semana")).toBe(true);
  });

  it("el envío de prueba muestra todo lo que todavía no pasó", () => {
    for (const d of [0, 3, 14, 29]) expect(efemerideEnMail(cumple, d, "todo")).toBe(true);
  });

  it("el período de prueba usa sus propios hitos, incluido el día 0", () => {
    for (const d of HITOS_PERIODO_PRUEBA) expect(efemerideEnMail(prueba, d, "hitos")).toBe(true);
    // 14 y 7 son hitos de cumpleaños, no suyos.
    for (const d of [14, 7]) expect(efemerideEnMail(prueba, d, "hitos")).toBe(false);
  });

  it("los hitos del período de prueba son los mismos con los que se GENERA la alerta", () => {
    // Si en lib/alertas.ts se cambian los días de disparo sin tocar esta lista,
    // la alerta existe en la campana pero no sale por mail (así se perdió el
    // aviso del día 0, que se generaba a 30/15/5 y se filtraba con 14/7/0).
    expect([...HITOS_PERIODO_PRUEBA].sort((a, b) => a - b)).toEqual([0, 5, 15, 30]);
    expect(HITOS_PERIODO_PRUEBA).toContain(0);
    expect(HITOS_EFEMERIDE).toContain(0);
  });

  it("sin fecha no hay nada que medir: no se descarta", () => {
    expect(efemerideEnMail(cumple, null, "hitos")).toBe(true);
  });
});

describe("tipoHabilitado", () => {
  const cumple = alerta({ tipo: "otro", entidad_tipo: "choferes_cumple" });

  it("falla abierto: sin la fila del parámetro el aviso igual sale", () => {
    expect(tipoHabilitado(cumple, new Map())).toBe(true);
  });

  it("sólo un 'false' explícito lo apaga", () => {
    const off = new Map([[alertaClave("rrhh_eventos"), "false"]]);
    expect(tipoHabilitado(cumple, off)).toBe(false);

    const on = new Map([[alertaClave("rrhh_eventos"), "true"]]);
    expect(tipoHabilitado(cumple, on)).toBe(true);
  });

  it("apagar una categoría no apaga a las demás", () => {
    const off = new Map([[alertaClave("rrhh_eventos"), "false"]]);
    const cheque = alerta({ tipo: "vencimiento_cheque", entidad_tipo: "cheques" });
    expect(tipoHabilitado(cheque, off)).toBe(true);
  });
});

describe("normalizarColumnas", () => {
  it("quien tenía 'Otros avisos' hereda las categorías que salieron de ahí", () => {
    const res = normalizarColumnas(["cheques_vencidos", OTROS_AVISOS]);
    for (const k of COLUMNAS_ABIERTAS_DE_OTROS) expect(res).toContain(k);
    expect(res).toContain("cheques_vencidos");
  });

  it("no toca a quien nunca tuvo el cajón tildado", () => {
    expect(normalizarColumnas([PRESTAMOS_COL]).sort()).toEqual([PRESTAMOS_COL]);
  });

  it("respeta la elección del admin: si ya tocó una nueva, no re-agrega el resto", () => {
    const res = normalizarColumnas([OTROS_AVISOS, "impuestos"]);
    expect(res).toContain("impuestos");
    expect(res).not.toContain("mantenimiento");
  });

  it("es idempotente", () => {
    const una = normalizarColumnas([OTROS_AVISOS]);
    expect(normalizarColumnas(una).sort()).toEqual(una.sort());
  });
});
