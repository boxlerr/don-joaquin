import { describe, it, expect } from "vitest";
import {
  normalizar,
  crearMatcher,
  parseCantidad,
  parseBloquesAnio,
  parseCronograma,
  rangosPorPersona,
  type EmpleadoRef,
  type Matriz,
} from "./parser";

const EMPLEADOS: EmpleadoRef[] = [
  { id: "c1", apellido: "Schmidt", nombre: "Sergio Oscar", activo: true },
  { id: "c2", apellido: "Saenz Buruaga", nombre: "Gaston Roberto", activo: true },
  { id: "c3", apellido: "Cejas", nombre: "Nazareno Elías", activo: true },
  { id: "c4", apellido: "Cejas", nombre: "Diego David", activo: true },
  { id: "c5", apellido: "Paterno", nombre: "Anabela", activo: true },
  { id: "c6", apellido: "Martínez", nombre: "Walter Nicolas", activo: true },
  { id: "c7", apellido: "Juarez", nombre: "Luis Mario", activo: true },
  { id: "c8", apellido: "Juarez", nombre: "Luis Nahuel", activo: true },
  { id: "c9", apellido: "Asteazarán", nombre: "Agustín", activo: true },
  { id: "c10", apellido: "Asteazarán", nombre: "Cristian Antonio", activo: true },
];

describe("normalizar y matcher", () => {
  it("ignora acentos, comas y números finales", () => {
    expect(normalizar("Martínez,  Wálter 14")).toBe("martinez walter 14");
  });

  it("matchea por tokens sin importar el orden (NICOLAS MARTINEZ → Martínez Walter Nicolas)", () => {
    const m = crearMatcher(EMPLEADOS);
    const r = m("NICOLAS MARTINEZ 7");
    expect(r.tipo).toBe("ok");
    if (r.tipo === "ok") expect(r.empleado.id).toBe("c6");
  });

  it("resuelve alias/apodos (CEJAS N, ANABELA, JUAREZ LUIS vs NAHUEL)", () => {
    const m = crearMatcher(EMPLEADOS);
    expect(m("CEJAS N")).toMatchObject({ tipo: "ok", empleado: { id: "c3" } });
    expect(m("ANABELA")).toMatchObject({ tipo: "ok", empleado: { id: "c5" } });
    expect(m("Juarez Luis")).toMatchObject({ tipo: "ok", empleado: { id: "c7" } });
    expect(m("Juarez   Nahuel")).toMatchObject({ tipo: "ok", empleado: { id: "c8" } });
  });

  it("marca ambiguos en vez de adivinar (Asteazaran solo)", () => {
    const m = crearMatcher(EMPLEADOS);
    expect(m("Asteazaran").tipo).toBe("ambiguo");
  });
});

describe("parseCantidad", () => {
  it("lee los bloques por año aunque el valor esté en cualquier columna del bloque", () => {
    const rows: Matriz = [
      ["2026-12-31", null, "AÑOS", "MESES", "2022", null, null, null, "2023"],
      ["Schmidt Sergio", new Date(2015, 11, 1), 11, 0, null, 0, null, null, null, 0, null, null, null, 7, null, null, null, 14, null, null, 28],
    ];
    const out = parseCantidad(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.porAnio.get(2024)).toBe(7);
    expect(out[0]!.porAnio.get(2025)).toBe(14);
    expect(out[0]!.porAnio.get(2026)).toBe(28);
  });
});

describe("parseBloquesAnio", () => {
  it("junta bloques 2025/2026 aunque el nombre cambie de mayúsculas", () => {
    const rows: Matriz = [
      [new Date(2026, 11, 31), null, "AÑOS", "MESES", null, "PERIODO 2026"],
      ["PATERNO ANABELA", new Date(2022, 6, 1), 4, 5, 14, null, 7],
      [null],
      [new Date(2025, 11, 31), null, "AÑOS", "MESES", "DIAS", "PERIODO 2025"],
      ["Paterno Anabela", new Date(2022, 6, 1), 3, 5, 14, null, 0],
    ];
    const out = parseBloquesAnio(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.porAnio.get(2026)).toBe(7);
    expect(out[0]!.porAnio.get(2025)).toBe(0);
  });
});

describe("parseCronograma", () => {
  const semana = (lunes: Date) =>
    Array.from({ length: 7 }, (_, i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i));

  it("no confunde nombres que empiezan con S con encabezados de días", () => {
    const rows: Matriz = [
      ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
      semana(new Date(2026, 8, 14)),
      ["SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT"],
      ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
      semana(new Date(2026, 8, 21)),
      ["SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT", "SERGIO SCHMIDT"],
    ];
    const pres = parseCronograma(rows);
    expect(pres).toHaveLength(14);
    expect(pres[0]).toEqual({ nombre: "SERGIO SCHMIDT", fecha: "2026-09-14" });
  });

  it("arma rangos consecutivos por persona y junta semanas contiguas", () => {
    const rows: Matriz = [
      semana(new Date(2026, 6, 27)),
      ["GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA"],
      semana(new Date(2026, 7, 3)),
      [],
      semana(new Date(2026, 7, 17)),
      ["GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA", "GASTON SAENZ BURUAGA"],
    ];
    const { rangos, sinMatch } = rangosPorPersona(parseCronograma(rows), crearMatcher(EMPLEADOS));
    expect(sinMatch).toHaveLength(0);
    expect(rangos).toHaveLength(2);
    expect(rangos[0]).toMatchObject({ fecha_inicio: "2026-07-27", fecha_fin: "2026-08-02", dias: 7 });
    expect(rangos[1]).toMatchObject({ fecha_inicio: "2026-08-17", fecha_fin: "2026-08-23", dias: 7 });
  });

  it("lo que no matchea queda listado, nunca se importa solo", () => {
    const rows: Matriz = [semana(new Date(2026, 7, 3)), ["CHIFO", null, null, null, null, null, null]];
    const { rangos, sinMatch } = rangosPorPersona(parseCronograma(rows), crearMatcher(EMPLEADOS));
    expect(rangos).toHaveLength(0);
    expect(sinMatch).toEqual(["CHIFO"]);
  });
});
