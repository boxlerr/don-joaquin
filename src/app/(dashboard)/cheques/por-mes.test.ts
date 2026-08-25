import { describe, it, expect } from "vitest";
import { etiquetaMes, evolucionPorMes, resumenPorMes, siguePendiente, totalPendiente } from "./por-mes";
import type { ChequeParaMes } from "./por-mes";

const HOY = "2026-09-15";

const ch = (
  fecha: string,
  importe: number,
  estado: ChequeParaMes["estado"] = "cartera",
  origen: ChequeParaMes["origen"] = "recibido",
): ChequeParaMes => ({ origen, estado, importe, fecha_vencimiento: fecha });

describe("siguePendiente", () => {
  it("un cheque cobrado o pagado deja de pesar", () => {
    expect(siguePendiente({ origen: "recibido", estado: "acreditado" })).toBe(false);
    expect(siguePendiente({ origen: "propio", estado: "debitado" })).toBe(false);
  });

  it("rechazado y anulado tampoco cuentan", () => {
    expect(siguePendiente({ origen: "recibido", estado: "rechazado" })).toBe(false);
    expect(siguePendiente({ origen: "propio", estado: "anulado" })).toBe(false);
  });

  it("ENTREGADO significa lo opuesto según el lado", () => {
    // Uno que recibimos y endosamos ya salió: no lo vamos a cobrar.
    expect(siguePendiente({ origen: "recibido", estado: "entregado" })).toBe(false);
    // Uno nuestro entregado todavía no se debitó: hay que tener la plata.
    expect(siguePendiente({ origen: "propio", estado: "entregado" })).toBe(true);
  });

  it("en cartera, depositado y emitido siguen pesando", () => {
    expect(siguePendiente({ origen: "recibido", estado: "cartera" })).toBe(true);
    expect(siguePendiente({ origen: "recibido", estado: "depositado" })).toBe(true);
    expect(siguePendiente({ origen: "propio", estado: "emitido" })).toBe(true);
  });
});

describe("resumenPorMes", () => {
  it("agrupa por mes de vencimiento y suma los importes", () => {
    const r = resumenPorMes(
      [ch("2026-09-05", 100_000), ch("2026-09-28", 50_000), ch("2026-10-03", 80_000)],
      HOY,
    );
    expect(r.map((m) => [m.mes, m.monto, m.cantidad])).toEqual([
      ["2026-09", 150_000, 2],
      ["2026-10", 80_000, 1],
    ]);
  });

  it("EL PEDIDO: el monto se descuenta cuando el cheque se cierra", () => {
    const conTodos = resumenPorMes(
      [ch("2026-09-05", 100_000), ch("2026-09-28", 50_000)],
      HOY,
    );
    expect(conTodos[0]!.monto).toBe(150_000);

    const unoCobrado = resumenPorMes(
      [ch("2026-09-05", 100_000, "acreditado"), ch("2026-09-28", 50_000)],
      HOY,
    );
    expect(unoCobrado[0]!.monto).toBe(50_000);
    expect(unoCobrado[0]!.cantidad).toBe(1);
  });

  it("un mes que queda sin nada pendiente desaparece de la tira", () => {
    // Un mes en cero no cambia ninguna decisión.
    expect(resumenPorMes([ch("2026-09-05", 100_000, "acreditado")], HOY)).toEqual([]);
  });

  it("los meses van del más viejo al más nuevo", () => {
    const r = resumenPorMes(
      [ch("2027-01-10", 10), ch("2026-08-10", 20), ch("2026-12-10", 30)],
      HOY,
    );
    expect(r.map((m) => m.mes)).toEqual(["2026-08", "2026-12", "2027-01"]);
  });

  it("marca el mes en curso y los meses atrasados", () => {
    const r = resumenPorMes([ch("2026-08-10", 20), ch("2026-09-10", 30), ch("2026-11-10", 40)], HOY);
    expect(r.map((m) => [m.mes, m.atrasado, m.esteMes])).toEqual([
      ["2026-08", true, false],
      ["2026-09", false, true],
      ["2026-11", false, false],
    ]);
  });

  it("un cheque nuestro entregado sigue contando; uno recibido endosado no", () => {
    const r = resumenPorMes(
      [
        ch("2026-09-10", 100_000, "entregado", "propio"),
        ch("2026-09-11", 999_999, "entregado", "recibido"),
      ],
      HOY,
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.monto).toBe(100_000);
  });

  it("sin cheques no se rompe", () => {
    expect(resumenPorMes([], HOY)).toEqual([]);
    expect(totalPendiente([])).toBe(0);
  });
});

describe("etiquetaMes", () => {
  it("dentro del año en curso alcanza con el nombre del mes", () => {
    expect(etiquetaMes("2026-09", HOY)).toBe("Septiembre");
  });

  it("de otro año se aclara el año, o no se sabe de cuál habla", () => {
    expect(etiquetaMes("2027-01", HOY)).toBe("Ene 2027");
    expect(etiquetaMes("2025-12", HOY)).toBe("Dic 2025");
  });
});

describe("evolucionPorMes", () => {
  it("separa lo que entra de lo que sale", () => {
    const r = evolucionPorMes(
      [
        ch("2026-09-05", 100_000),
        ch("2026-09-20", 30_000, "emitido", "propio"),
      ],
      HOY,
    );
    expect(r).toEqual([
      { mes: "2026-09", label: "Septiembre", aCobrar: 100_000, aPagar: 30_000, neto: 70_000 },
    ]);
  });

  it("el neto negativo marca el mes en que sale más de lo que entra", () => {
    const r = evolucionPorMes([ch("2026-09-20", 500_000, "emitido", "propio")], HOY);
    expect(r[0]!.neto).toBe(-500_000);
  });

  it("rellena los meses del medio: un hueco mentiría sobre la distancia", () => {
    const r = evolucionPorMes([ch("2026-09-05", 10), ch("2026-12-05", 20)], HOY);
    expect(r.map((m) => m.mes)).toEqual(["2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(r[1]!.aCobrar).toBe(0);
  });

  it("no cuenta los cheques ya cerrados", () => {
    expect(evolucionPorMes([ch("2026-09-05", 999, "acreditado")], HOY)).toEqual([]);
  });

  it("una fecha disparatada no cuelga la pantalla", () => {
    const r = evolucionPorMes([ch("2026-09-05", 10), ch("2200-01-05", 20)], HOY);
    expect(r.length).toBeLessThanOrEqual(120);
  });
});
