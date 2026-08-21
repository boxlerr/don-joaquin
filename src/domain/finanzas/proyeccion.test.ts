import { describe, it, expect } from "vitest";
import {
  construirProyeccion,
  evaluarMes,
  mergeTopesFinanzas,
  mesesEntre,
  primerMesComplicado,
  proyectarFacturacion,
  sumarMes,
  TOPES_FINANZAS_DEFAULT,
  type Compromiso,
  type Cobertura,
  type FuenteEgreso,
  type ProyeccionInput,
} from "./proyeccion";

const COBERTURA_TODO_FIRME: Record<FuenteEgreso, Cobertura> = {
  prestamos: "firme",
  cheques: "firme",
  sueldos: "firme",
  impuestos: "firme",
};

// Lo que pasa hoy de verdad: préstamos y cheques están completos, sueldos e
// impuestos no. Es el caso que el desglose tiene que dejar ver.
const COBERTURA_REAL: Record<FuenteEgreso, Cobertura> = {
  prestamos: "firme",
  cheques: "firme",
  sueldos: "parcial",
  impuestos: "parcial",
};

function armar(over: Partial<ProyeccionInput> = {}) {
  const base: ProyeccionInput = {
    compromisos: [],
    historicoFacturacion: [],
    ausentesPorMes: {},
    cobertura: COBERTURA_TODO_FIRME,
    topes: { ...TOPES_FINANZAS_DEFAULT },
    mesActual: "2026-08",
    meses: 3,
    ...over,
  };
  return construirProyeccion(base);
}

describe("meses", () => {
  it("suma sin pasar por Date, así no se come el huso", () => {
    expect(sumarMes("2026-08", 1)).toBe("2026-09");
    expect(sumarMes("2026-12", 1)).toBe("2027-01");
    expect(sumarMes("2026-01", -1)).toBe("2025-12");
  });

  it("lista el rango con los dos extremos adentro", () => {
    expect(mesesEntre("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});

describe("la configuración la ponen ellos", () => {
  it("sin nada guardado no hay ningún tope", () => {
    const t = mergeTopesFinanzas(null);
    expect(t.egresosMes).toBeNull();
    expect(t.pctFacturacion).toBeNull();
  });

  it("un tope en cero es 'sin tope', no 'avisar siempre'", () => {
    const t = mergeTopesFinanzas({ egresosMes: 0, pctFacturacion: 0 });
    expect(t.egresosMes).toBeNull();
    expect(t.pctFacturacion).toBeNull();
  });

  it("los meses a promediar quedan entre 1 y 24", () => {
    expect(mergeTopesFinanzas({ mesesPromedio: 0 }).mesesPromedio).toBe(1);
    expect(mergeTopesFinanzas({ mesesPromedio: 999 }).mesesPromedio).toBe(24);
  });
});

describe("sin tope configurado no hay alerta", () => {
  it("por más plata que haya comprometida", () => {
    const proy = armar({
      compromisos: [{ fuente: "prestamos", fecha: "2026-09-04", monto: 900_000_000 }],
    });
    expect(proy.every((m) => m.nivel === "ok")).toBe(true);
    expect(primerMesComplicado(proy)).toBeNull();
  });
});

describe("proyección de facturación", () => {
  const historico = [
    { mes: "2026-05", monto: 100 },
    { mes: "2026-06", monto: 200 },
    { mes: "2026-07", monto: 300 },
  ];

  it("promedia los últimos meses CERRADOS", () => {
    const r = proyectarFacturacion(historico, "2026-08", 3);
    expect(r.monto).toBe(200);
    expect(r.base).toEqual({ metodo: "promedio", meses: 3 });
  });

  it("el mes en curso no entra: se está cargando y tiraría el promedio abajo", () => {
    const r = proyectarFacturacion([...historico, { mes: "2026-08", monto: 1 }], "2026-08", 3);
    expect(r.monto).toBe(200);
  });

  it("sin historial no inventa una proyección", () => {
    const r = proyectarFacturacion([], "2026-08", 3);
    expect(r.monto).toBeNull();
    expect(r.base).toEqual({ metodo: "sin_historico" });
  });

  it("dice con cuántos meses la armó, aunque sean menos de los pedidos", () => {
    const r = proyectarFacturacion([{ mes: "2026-07", monto: 50 }], "2026-08", 6);
    expect(r.base).toEqual({ metodo: "promedio", meses: 1 });
  });
});

describe("evaluarMes", () => {
  it("avisa por el tope en pesos", () => {
    const r = evaluarMes(150, null, { egresosMes: 100, pctFacturacion: null, mesesPromedio: 3 });
    expect(r.nivel).toBe("excedido");
    expect(r.motivo).toBe("tope_pesos");
    expect(r.exceso?.exceso).toBe(50);
  });

  it("avisa por el % de la facturación proyectada", () => {
    // 70% de 1000 = 700; se comprometieron 800.
    const r = evaluarMes(800, 1000, { egresosMes: null, pctFacturacion: 70, mesesPromedio: 3 });
    expect(r.nivel).toBe("excedido");
    expect(r.motivo).toBe("pct_facturacion");
    expect(r.exceso?.exceso).toBe(100);
  });

  it("el tope por % no puede evaluarse sin proyección, y no rompe", () => {
    const r = evaluarMes(800, null, { egresosMes: null, pctFacturacion: 70, mesesPromedio: 3 });
    expect(r.nivel).toBe("ok");
  });

  it("con los dos topes pasados, habla del exceso más grande", () => {
    // Pesos: 900 − 800 = 100. Porcentaje: 50% de 1000 = 500, exceso 400.
    const r = evaluarMes(900, 1000, { egresosMes: 800, pctFacturacion: 50, mesesPromedio: 3 });
    expect(r.motivo).toBe("pct_facturacion");
    expect(r.exceso?.exceso).toBe(400);
  });

  it("justo en el tope no avisa: se avisa cuando se pasa", () => {
    expect(evaluarMes(100, null, { egresosMes: 100, pctFacturacion: null, mesesPromedio: 3 }).nivel).toBe("ok");
  });
});

describe("el total dice de qué está hecho", () => {
  const compromisos: Compromiso[] = [
    { fuente: "prestamos", fecha: "2026-09-04", monto: 300 },
    { fuente: "prestamos", fecha: "2026-09-18", monto: 200 },
    { fuente: "cheques", fecha: "2026-09-10", monto: 100 },
    { fuente: "impuestos", fecha: "2026-09-20", monto: 50 },
  ];

  it("desglosa por fuente y cuenta los ítems, para poder auditarlo", () => {
    const sep = armar({ compromisos })[1]!;
    expect(sep.mes).toBe("2026-09");
    const prest = sep.aportes.find((a) => a.fuente === "prestamos")!;
    expect(prest.monto).toBe(500);
    expect(prest.items).toBe(2);
    expect(sep.totalEgresos).toBe(650);
  });

  it("separa lo firme de lo que subestima", () => {
    const sep = armar({ compromisos, cobertura: COBERTURA_REAL })[1]!;
    expect(sep.totalEgresos).toBe(650);
    // Impuestos es parcial: sus 50 no cuentan como firmes.
    expect(sep.totalFirme).toBe(600);
    expect(sep.huecos).toContain("impuestos");
    expect(sep.huecos).toContain("sueldos");
    expect(sep.huecos).not.toContain("prestamos");
  });

  it("una fuente firme sin movimientos no es un hueco: es que no se paga nada", () => {
    // Cheques está completo y ese mes no hay ninguno. No puede leerse como
    // "falta cargar cheques", porque no falta nada.
    const oct = armar({ compromisos, cobertura: COBERTURA_TODO_FIRME })[2]!;
    expect(oct.mes).toBe("2026-10");
    expect(oct.huecos).toEqual([]);
    expect(oct.totalEgresos).toBe(0);
  });

  it("una fuente parcial sin movimientos SÍ deja el total corto", () => {
    const oct = armar({ compromisos, cobertura: COBERTURA_REAL })[2]!;
    const imp = oct.aportes.find((a) => a.fuente === "impuestos")!;
    expect(imp.cobertura).toBe("sin_datos");
    expect(oct.huecos).toContain("impuestos");
  });

  it("las cuatro fuentes aparecen siempre, aunque estén en cero", () => {
    const sep = armar({ compromisos })[1]!;
    expect(sep.aportes.map((a) => a.fuente).sort()).toEqual([
      "cheques",
      "impuestos",
      "prestamos",
      "sueldos",
    ]);
  });
});

describe("el caso que contó Bárbara", () => {
  // "Fijate que en septiembre te las vas a ver negras: la facturación viene
  // baja, se te juntaron préstamos y cheques, y tenés seis choferes de
  // vacaciones, por ende seis camiones sin facturar."
  const proy = armar({
    meses: 3,
    compromisos: [
      { fuente: "prestamos", fecha: "2026-09-04", monto: 700 },
      { fuente: "cheques", fecha: "2026-09-15", monto: 300 },
      { fuente: "prestamos", fecha: "2026-10-04", monto: 100 },
    ],
    historicoFacturacion: [
      { mes: "2026-05", monto: 1200 },
      { mes: "2026-06", monto: 1200 },
      { mes: "2026-07", monto: 1200 },
    ],
    ausentesPorMes: { "2026-09": 6 },
    topes: { egresosMes: null, pctFacturacion: 70, mesesPromedio: 3 },
  });

  it("septiembre salta y octubre no", () => {
    expect(proy[1]!.mes).toBe("2026-09");
    expect(proy[1]!.nivel).toBe("excedido");
    expect(proy[2]!.nivel).toBe("ok");
  });

  it("el primero complicado es el que mira el dashboard", () => {
    expect(primerMesComplicado(proy)?.mes).toBe("2026-09");
  });

  it("lleva los seis ausentes, que es el cruce que ella nombró", () => {
    expect(proy[1]!.ausentes).toBe(6);
    expect(proy[0]!.ausentes).toBe(0);
  });

  it("dice contra qué facturación se comparó", () => {
    expect(proy[1]!.facturacionProyectada).toBe(1200);
    expect(proy[1]!.baseFacturacion).toEqual({ metodo: "promedio", meses: 3 });
  });
});
