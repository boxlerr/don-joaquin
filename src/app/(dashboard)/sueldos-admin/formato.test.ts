import { describe, expect, it } from "vitest";
import { formatMiles, mesCortoLabel, parseNum } from "./formato";

describe("formatMiles", () => {
  it("pone separador de miles AR", () => {
    expect(formatMiles("3132496")).toBe("3.132.496");
    expect(formatMiles("0")).toBe("0");
    expect(formatMiles("")).toBe("");
  });

  // El bug que llegó a producción: los importes de la base vienen con centavos
  // (numeric), y al sacar TODO lo que no fuera dígito el sueldo de $3.132.496
  // se mostraba como 313.249.584 — cien veces más.
  it("ignora los centavos en vez de pegarlos a los pesos", () => {
    expect(formatMiles("3132495.84")).toBe("3.132.495");
    expect(formatMiles("3207675.74")).toBe("3.207.675");
    expect(formatMiles("1857716,5")).toBe("1.857.716");
  });

  it("mantiene el signo mientras se escribe un negativo", () => {
    expect(formatMiles("-")).toBe("-");
    expect(formatMiles("-5000")).toBe("-5.000");
  });
});

describe("parseNum", () => {
  it("lee el formato AR (punto de miles, coma decimal)", () => {
    expect(parseNum("3.132.496")).toBe(3132496);
    expect(parseNum("3132496,50")).toBe(3132496.5);
    expect(parseNum("")).toBeNull();
    expect(parseNum("   ")).toBeNull();
  });

  // Al pegar desde el Excel las celdas llegan con "$", espacios y demás adornos.
  it("tolera lo que viene pegado de una planilla", () => {
    expect(parseNum("$ 3.132.496")).toBe(3132496);
    expect(parseNum(" 290.000 ")).toBe(290000);
    expect(parseNum("texto")).toBeNull();
  });
});

describe("mesCortoLabel", () => {
  it("arma el mes abreviado con año", () => {
    expect(mesCortoLabel("2026-07")).toBe("jul 2026");
    expect(mesCortoLabel("2026-12-01")).toBe("dic 2026");
  });
});
