import { describe, it, expect } from "vitest";
import { resolverPeriodo, esFechaISO, slugArchivo } from "./periodo";

const q = (s: string) => new URLSearchParams(s);

describe("resolverPeriodo — un mes (la forma de siempre)", () => {
  it("mes normal: del 1 al último día", () => {
    expect(resolverPeriodo(q("mes=2026-07"))).toEqual({
      desde: "2026-07-01",
      hasta: "2026-07-31",
      label: "2026-07",
      titulo: "Julio 2026",
    });
  });

  it("febrero de un año bisiesto llega hasta el 29", () => {
    const p = resolverPeriodo(q("mes=2024-02"));
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.hasta).toBe("2024-02-29");
  });

  it("febrero de un año no bisiesto llega hasta el 28", () => {
    const p = resolverPeriodo(q("mes=2026-02"));
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.hasta).toBe("2026-02-28");
  });

  it("histórico", () => {
    expect(resolverPeriodo(q("mes=total"))).toMatchObject({
      label: "historico",
      titulo: "Histórico completo",
    });
  });

  it("sin parámetros cae en el mes actual", () => {
    const p = resolverPeriodo(q(""));
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.label).toBe(new Date().toISOString().slice(0, 7));
  });

  it("mes con número imposible da error en vez de un Excel vacío", () => {
    expect(resolverPeriodo(q("mes=2026-13"))).toEqual({ error: "El mes no es válido." });
  });
});

describe("resolverPeriodo — rango (lo que pidió la oficina)", () => {
  it("rango válido", () => {
    expect(resolverPeriodo(q("desde=2026-05-10&hasta=2026-07-15"))).toEqual({
      desde: "2026-05-10",
      hasta: "2026-07-15",
      label: "2026-05-10_a_2026-07-15",
      titulo: "10/05/2026 al 15/07/2026",
    });
  });

  it("un solo día", () => {
    const p = resolverPeriodo(q("desde=2026-07-31&hasta=2026-07-31"));
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.desde).toBe(p.hasta);
  });

  it("el rango le gana al mes si vienen los dos", () => {
    const p = resolverPeriodo(q("mes=2026-01&desde=2026-05-01&hasta=2026-05-31"));
    expect("error" in p).toBe(false);
    if ("error" in p) return;
    expect(p.desde).toBe("2026-05-01");
  });

  it("rango dado vuelta: error, no un Excel vacío", () => {
    expect(resolverPeriodo(q("desde=2026-07-15&hasta=2026-05-10"))).toEqual({
      error: "La fecha 'desde' es posterior a la de 'hasta'.",
    });
  });

  it("media fecha (solo desde) es error, no medio mes", () => {
    expect("error" in resolverPeriodo(q("desde=2026-07-01"))).toBe(true);
  });

  it("fecha que no existe en el calendario", () => {
    expect("error" in resolverPeriodo(q("desde=2026-02-31&hasta=2026-03-05"))).toBe(true);
  });

  it("basura en la fecha", () => {
    expect("error" in resolverPeriodo(q("desde=ayer&hasta=hoy"))).toBe(true);
  });
});

describe("esFechaISO", () => {
  it.each([
    ["2026-07-31", true],
    ["2024-02-29", true],
    ["2026-02-29", false], // 2026 no es bisiesto
    ["2026-13-01", false],
    ["2026-00-10", false],
    ["2026-07-00", false],
    ["2026-7-1", false],
    ["", false],
  ])("%s → %s", (v, esperado) => {
    expect(esFechaISO(v)).toBe(esperado);
  });
});

describe("slugArchivo", () => {
  it("saca acentos y espacios del apellido", () => {
    expect(slugArchivo("DE LIBANO")).toBe("DE-LIBANO");
    expect(slugArchivo("MARTÍNEZ")).toBe("MARTINEZ");
  });

  it("no deja comillas ni barras que rompan el Content-Disposition", () => {
    expect(slugArchivo('PE"REZ/GO\\MEZ')).toBe("PE-REZ-GO-MEZ");
  });
});
