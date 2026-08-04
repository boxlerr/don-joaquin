import { describe, expect, it } from "vitest";
import { amt, ars, claveProveedor, formatMilesAR, parseNum, variacion } from "./formato";

describe("parseNum", () => {
  it("lee el formato argentino: coma decimal y puntos de miles", () => {
    expect(parseNum("372.025,11")).toBe(372025.11);
    expect(parseNum("1.234")).toBe(1234);
    expect(parseNum("85.593.869,65")).toBe(85593869.65);
  });

  // El Excel del contador escribe en inglés y quien carga a mano escribe en
  // argentino: los dos formatos entran por la misma celda.
  it("lee el formato inglés: coma de miles y punto decimal", () => {
    expect(parseNum("3,049,365.80")).toBe(3049365.8);
    expect(parseNum("2,000")).toBe(2000);
  });

  it("trata el punto como decimal cuando lo siguen una o dos cifras", () => {
    expect(parseNum("372025.11")).toBe(372025.11);
    expect(parseNum("1.5")).toBe(1.5);
    expect(parseNum("1,5")).toBe(1.5);
  });

  it("tres cifras después del separador son miles, no decimales", () => {
    expect(parseNum("2.000")).toBe(2000);
    expect(parseNum("1.234")).toBe(1234);
  });

  it("conserva el signo", () => {
    expect(parseNum("-372.025,11")).toBe(-372025.11);
  });

  it("tolera los adornos que arrastra el Excel", () => {
    expect(parseNum("$ 1.500,50")).toBe(1500.5);
    expect(parseNum("  2.000  ")).toBe(2000);
  });

  it("devuelve null cuando no hay número", () => {
    expect(parseNum("")).toBeNull();
    expect(parseNum("SCANIA")).toBeNull();
  });
});

describe("amt — el signo lo dan los paréntesis del export contable", () => {
  it("entre paréntesis es un costo (positivo), en cualquiera de los dos formatos", () => {
    expect(amt("(3,049,365.80)")).toBeCloseTo(3049365.8, 2);
    expect(amt("(225.320,68)")).toBeCloseTo(225320.68, 2);
  });

  it("sin paréntesis es una nota de crédito (negativa)", () => {
    // El caso real: R. G. COMERCIAL, enero '26. Tomarlo positivo dejaba el mes
    // $744.050 arriba del total del Excel.
    expect(amt("372,025.11")).toBeCloseTo(-372025.11, 2);
  });

  it("no inventa un cero para la celda vacía", () => {
    expect(amt("")).toBeNull();
    expect(amt("   ")).toBeNull();
  });
});

describe("formatMilesAR — no puede comerse los centavos", () => {
  it("pone los puntos de miles y conserva los dos decimales", () => {
    expect(formatMilesAR("372025.11")).toBe("372.025,11");
    expect(formatMilesAR("85593869,65")).toBe("85.593.869,65");
  });

  it("conserva el signo de una nota de crédito", () => {
    expect(formatMilesAR("-372025.11")).toBe("-372.025,11");
  });

  it("deja escribir la coma y el primer decimal", () => {
    expect(formatMilesAR("1234")).toBe("1.234");
    expect(formatMilesAR("1234,")).toBe("1.234,");
    expect(formatMilesAR("1234,5")).toBe("1.234,5");
  });

  it("no rompe con la celda vacía ni con el signo solo", () => {
    expect(formatMilesAR("")).toBe("");
    expect(formatMilesAR("-")).toBe("-");
  });

  it("ida y vuelta: lo que se muestra se vuelve a leer igual", () => {
    for (const n of [0, 1234, 372025.11, -372025.11, 85593869.65]) {
      expect(parseNum(formatMilesAR(String(n)))).toBeCloseTo(n, 2);
    }
  });
});

describe("ars", () => {
  it("antepone el signo al peso, no al número", () => {
    expect(ars(85593870)).toBe("$ 85.593.870");
    expect(ars(-372025.11)).toBe("-$ 372.025");
  });
});

describe("variacion", () => {
  it("compara contra el mes anterior", () => {
    expect(variacion(110, 100)).toBeCloseTo(10);
    expect(variacion(90, 100)).toBeCloseTo(-10);
  });

  it("usa el valor absoluto del previo: con un crédito el signo se daba vuelta", () => {
    expect(variacion(100, -100)).toBeCloseTo(200);
  });

  it("no compara contra la nada ni contra cero", () => {
    expect(variacion(100, undefined)).toBeNull();
    expect(variacion(100, 0)).toBeNull();
  });
});

describe("claveProveedor", () => {
  it("empareja el mismo proveedor escrito distinto", () => {
    expect(claveProveedor("Metalúrgica Herrera S.A.")).toBe(
      claveProveedor("METALURGICA  HERRERA S.A. "),
    );
    expect(claveProveedor("Scania Argentina S.A.")).toBe(claveProveedor("SCANIA ARGENTINA S.A."));
  });

  it("no confunde proveedores distintos", () => {
    expect(claveProveedor("RUTA SUR TRUCK SA")).not.toBe(claveProveedor("PUNTO TRUCK S.A."));
  });
});
