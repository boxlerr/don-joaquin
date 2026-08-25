import { describe, it, expect } from "vitest";
import { estadoEnFecha, evolucionCartera, finDeMes, ultimosMeses } from "./evolucion";
import type { ChequeParaEvolucion, TransicionCheque } from "./evolucion";

const ch = (o: Partial<ChequeParaEvolucion> = {}): ChequeParaEvolucion => ({
  id: "c1", origen: "recibido", estado: "cartera", importe: 100,
  fecha_vencimiento: "2026-09-15", desde: "2026-01-01", ...o,
});

describe("estadoEnFecha", () => {
  it("sin transiciones, el cheque sigue como nació", () => {
    expect(estadoEnFecha({ origen: "recibido" }, [], "2026-08-31")).toBe("cartera");
    expect(estadoEnFecha({ origen: "propio" }, [], "2026-08-31")).toBe("emitido");
  });

  it("toma la última transición ANTERIOR al corte, no la actual", () => {
    // El cheque hoy está acreditado, pero al 31/07 todavía estaba depositado.
    const t: TransicionCheque[] = [
      { cheque_id: "c1", estado_nuevo: "depositado", fecha: "2026-07-10" },
      { cheque_id: "c1", estado_nuevo: "acreditado", fecha: "2026-08-05" },
    ];
    expect(estadoEnFecha({ origen: "recibido" }, t, "2026-07-31")).toBe("depositado");
    expect(estadoEnFecha({ origen: "recibido" }, t, "2026-08-31")).toBe("acreditado");
  });

  it("no le importa el orden en que vengan", () => {
    const t: TransicionCheque[] = [
      { cheque_id: "c1", estado_nuevo: "acreditado", fecha: "2026-08-05" },
      { cheque_id: "c1", estado_nuevo: "depositado", fecha: "2026-07-10" },
    ];
    expect(estadoEnFecha({ origen: "recibido" }, t, "2026-07-31")).toBe("depositado");
  });
});

describe("evolucionCartera", () => {
  const meses = ["2026-08", "2026-09", "2026-10"];

  it("un recibido se mueve de cartera a por vencer y después a vencido", () => {
    const r = evolucionCartera([ch({ fecha_vencimiento: "2026-09-15" })], [], meses, 2026);
    expect(r.map((m) => [m.enCartera, m.porVencer, m.vencidos])).toEqual([
      [100, 0, 0], // en agosto todavía no vence
      [0, 100, 0], // vence en septiembre
      [0, 0, 100], // en octubre ya venció y sigue sin cobrar
    ]);
  });

  it("cuando se acredita deja de contar en los meses siguientes", () => {
    const t: TransicionCheque[] = [
      { cheque_id: "c1", estado_nuevo: "acreditado", fecha: "2026-09-20" },
    ];
    const r = evolucionCartera([ch({ fecha_vencimiento: "2026-09-15" })], t, meses, 2026);
    // Al cierre de agosto todavía estaba en cartera...
    expect(r[0]!.enCartera).toBe(100);
    // ...y al cierre de septiembre ya se había cobrado (20/09), así que sale de
    // las cuatro series. La foto es al ÚLTIMO día del mes, no a mitad.
    expect(r[1]!.enCartera + r[1]!.porVencer + r[1]!.vencidos).toBe(0);
    expect(r[2]!.vencidos).toBe(0);
  });

  it("antes de que el sistema lo conozca, el cheque no suma", () => {
    // Sumarlo inventaría cartera que nadie tenía.
    const r = evolucionCartera([ch({ desde: "2026-10-05" })], [], meses, 2026);
    expect(r[0]!.enCartera).toBe(0);
    expect(r[1]!.enCartera).toBe(0);
    expect(r[2]!.vencidos).toBe(100);
  });

  it("los nuestros van en su propia serie", () => {
    const r = evolucionCartera(
      [ch({ id: "p1", origen: "propio", estado: "entregado", importe: 500 })], [], meses, 2026,
    );
    expect(r[0]!.nuestros).toBe(500);
    expect(r[0]!.enCartera).toBe(0);
  });

  it("un recibido endosado sale de la cuenta; un propio entregado no", () => {
    const endoso: TransicionCheque[] = [
      { cheque_id: "c1", estado_nuevo: "entregado", fecha: "2026-08-10" },
    ];
    const r = evolucionCartera([ch()], endoso, meses, 2026);
    expect(r[0]!.enCartera).toBe(0);
  });
});

describe("meses", () => {
  it("finDeMes agarra el último día, también en febrero", () => {
    expect(finDeMes("2026-08")).toBe("2026-08-31");
    expect(finDeMes("2026-02")).toBe("2026-02-28");
    expect(finDeMes("2028-02")).toBe("2028-02-29");
  });

  it("ultimosMeses cuenta hacia atrás cruzando el año", () => {
    expect(ultimosMeses("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
