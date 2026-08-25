import { describe, it, expect } from "vitest";
import {
  carga,
  excedeTope,
  hayAlgunTopeCaja,
  inicioDeMes,
  mergeTopesCaja,
  nivel,
  nombreDeMes,
  topeDe,
  TOPES_CAJA_DEFAULT,
} from "./topes";

describe("mergeTopesCaja", () => {
  it("sin nada guardado deja las dos cajas sin tope", () => {
    expect(mergeTopesCaja(null)).toEqual(TOPES_CAJA_DEFAULT);
    expect(mergeTopesCaja(undefined)).toEqual(TOPES_CAJA_DEFAULT);
    expect(mergeTopesCaja("no es un objeto")).toEqual(TOPES_CAJA_DEFAULT);
  });

  it("un tope en cero es SIN TOPE, no 'avisar siempre'", () => {
    // Es la diferencia entre una pantalla que se calla hasta que la configuran
    // y una que grita desde el primer día.
    expect(mergeTopesCaja({ diaria: 0, grande: -5 })).toEqual({ diaria: null, grande: null });
  });

  it("acepta el número escrito como texto y lo redondea", () => {
    expect(mergeTopesCaja({ diaria: "1500000.4", grande: 2_000_000 })).toEqual({
      diaria: 1_500_000,
      grande: 2_000_000,
    });
  });

  it("ignora claves que no son cajas", () => {
    expect(mergeTopesCaja({ diaria: 100, todas: 999 })).toEqual({ diaria: 100, grande: null });
  });
});

describe("topeDe", () => {
  const topes = { diaria: 1_000_000, grande: 5_000_000 };

  it("devuelve el tope de la caja que se está mirando", () => {
    expect(topeDe(topes, "diaria")).toBe(1_000_000);
    expect(topeDe(topes, "grande")).toBe(5_000_000);
  });

  it("'todas' no tiene tope propio: sumar los dos sería un número que nadie configuró", () => {
    expect(topeDe(topes, "todas")).toBeNull();
  });
});

describe("nivel y carga", () => {
  it("sin tope no hay nivel que mostrar", () => {
    expect(carga(999_999, null)).toBeNull();
    expect(nivel(999_999, null)).toBe("ok");
  });

  it("ok hasta el 85%, cerca desde ahí, excedido pasando el tope", () => {
    expect(nivel(800_000, 1_000_000)).toBe("ok");
    expect(nivel(850_000, 1_000_000)).toBe("cerca");
    expect(nivel(1_000_000, 1_000_000)).toBe("cerca");
    expect(nivel(1_000_001, 1_000_000)).toBe("excedido");
  });

  it("justo en el tope todavía no se pasó", () => {
    expect(excedeTope(1_000_000, 1_000_000)).toBeNull();
  });

  it("pasado el tope informa cuánto y qué porcentaje", () => {
    expect(excedeTope(1_200_000, 1_000_000)).toEqual({ exceso: 200_000, porcentaje: 20 });
  });
});

describe("hayAlgunTopeCaja", () => {
  it("es falso sólo cuando ninguna caja tiene tope", () => {
    expect(hayAlgunTopeCaja({ diaria: null, grande: null })).toBe(false);
    expect(hayAlgunTopeCaja({ diaria: 1, grande: null })).toBe(true);
    expect(hayAlgunTopeCaja({ diaria: null, grande: 1 })).toBe(true);
  });
});

describe("fechas del mes", () => {
  it("inicioDeMes recorta al día 1 sin tocar el mes", () => {
    expect(inicioDeMes("2026-08-25")).toBe("2026-08-01");
    expect(inicioDeMes("2026-01-31")).toBe("2026-01-01");
  });

  it("nombreDeMes se lee como lo diría una persona", () => {
    expect(nombreDeMes("2026-08-01")).toBe("agosto de 2026");
    expect(nombreDeMes("2026-12-01")).toBe("diciembre de 2026");
  });
});
