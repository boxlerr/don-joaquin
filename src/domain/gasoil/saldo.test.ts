import { describe, it, expect } from "vitest";
import { calcularSaldo, estaEnCurso, rotuloDeSaldo, type CargaDeclarada } from "./saldo";

const carga = (litros: number): CargaDeclarada => ({ litros });

/** La vuelta real del 01/09: IBICUY → LAJE41, 35 tn × 26,88 = 940,8 L. */
const AUTORIZADOS = 940.8;

describe("calcularSaldo", () => {
  it("una vuelta sin cargas tiene el saldo entero", () => {
    const s = calcularSaldo(AUTORIZADOS, []);
    expect(s).toMatchObject({
      cargados: 0,
      restantes: 940.8,
      excedido: false,
      sinCargas: true,
    });
    expect(s.usadoPct).toBe(0);
  });

  it("suma las cargas, incluidas las que traía de antes", () => {
    const s = calcularSaldo(AUTORIZADOS, [carga(300), carga(220)]);
    expect(s.cargados).toBe(520);
    expect(s.restantes).toBe(420.8);
    expect(s.usadoPct).toBeCloseTo(55.3, 1);
  });

  it("cargar de más NO se planta en cero: dice por cuánto se pasó", () => {
    const s = calcularSaldo(AUTORIZADOS, [carga(1000)]);
    expect(s.restantes).toBe(-59.2);
    expect(s.excedido).toBe(true);
  });

  it("no arrastra el ruido de sumar decimales", () => {
    // 0,1 + 0,2 en binario da 0.30000000000000004.
    const s = calcularSaldo(1, [carga(0.1), carga(0.2)]);
    expect(s.cargados).toBe(0.3);
    expect(s.restantes).toBe(0.7);
  });

  it("no divide por cero cuando la vuelta no autorizó nada", () => {
    expect(calcularSaldo(0, [carga(50)]).usadoPct).toBeNull();
  });
});

describe("rotuloDeSaldo", () => {
  it("le avisa cuando se pasó, con los dos números", () => {
    const r = rotuloDeSaldo(calcularSaldo(940.8, [carga(1000)]));
    expect(r.titulo).toBe("Te pasaste");
    expect(r.detalle).toContain("1.000,0");
    expect(r.detalle).toContain("940,8");
  });

  it("distingue la vuelta sin empezar de la vuelta a medias", () => {
    expect(rotuloDeSaldo(calcularSaldo(940.8, [])).titulo).toBe("Podés cargar");
    expect(rotuloDeSaldo(calcularSaldo(940.8, [carga(300)])).titulo).toBe("Te quedan");
  });

  it("cuando cargó justo, lo dice y no muestra un cero pelado", () => {
    const r = rotuloDeSaldo(calcularSaldo(940.8, [carga(940.8)]));
    expect(r.titulo).toBe("Ya cargaste todo");
    expect(r.detalle).toContain("940,8");
  });
});

describe("estaEnCurso", () => {
  it("la vuelta de hoy está en curso; la de ayer es historial", () => {
    expect(estaEnCurso("2026-09-02", "2026-09-02")).toBe(true);
    expect(estaEnCurso("2026-09-01", "2026-09-02")).toBe(false);
  });
});
