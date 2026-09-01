import { describe, it, expect } from "vitest";
import {
  anioDeBaja,
  cuentaParaRotacion,
  mesesEntreFechas,
  tipoBajaDesdeMotivo,
} from "./baja-desde-legajo";

/**
 * Convertir un egreso del legajo en una baja de rotación.
 *
 * Bárbara, 31/08/2026: *"yo ahí saqué dos de los legajos y no se actualizó en las
 * bajas... para qué actualizo la pantalla. No, sigue igual"*. Lo que se cuida acá
 * es la traducción entre los dos vocabularios, que es donde se puede mentir sin
 * que nadie se entere: un abandono contado como renuncia mueve el índice de
 * rotación voluntaria.
 */
describe("tipoBajaDesdeMotivo", () => {
  it("traduce los cuatro motivos del legajo", () => {
    expect(tipoBajaDesdeMotivo("renuncia")).toBe("renuncia_voluntaria");
    expect(tipoBajaDesdeMotivo("despido")).toBe("despido");
    expect(tipoBajaDesdeMotivo("jubilacion")).toBe("jubilacion");
    expect(tipoBajaDesdeMotivo("otro")).toBe("otro");
  });

  it("lo que no se sabe entra como 'otro', nunca como renuncia", () => {
    // Es la diferencia entre rotación voluntaria e involuntaria: adivinar acá
    // le cambia el número a la pantalla.
    expect(tipoBajaDesdeMotivo(null)).toBe("otro");
    expect(tipoBajaDesdeMotivo(undefined)).toBe("otro");
    expect(tipoBajaDesdeMotivo("")).toBe("otro");
    expect(tipoBajaDesdeMotivo("abandono")).toBe("otro");
    expect(tipoBajaDesdeMotivo("cualquier cosa")).toBe("otro");
  });
});

describe("mesesEntreFechas", () => {
  it("cuenta meses cumplidos, no empezados", () => {
    expect(mesesEntreFechas("2026-01-15", "2026-02-14")).toBe(0);
    expect(mesesEntreFechas("2026-01-15", "2026-02-15")).toBe(1);
    expect(mesesEntreFechas("2024-06-10", "2026-06-10")).toBe(24);
  });

  it("cruza el año sin equivocarse", () => {
    expect(mesesEntreFechas("2025-11-30", "2026-02-28")).toBe(2);
    expect(mesesEntreFechas("2025-12-01", "2026-01-01")).toBe(1);
  });

  it("sin alguna de las dos fechas no inventa una antigüedad", () => {
    expect(mesesEntreFechas(null, "2026-02-01")).toBeNull();
    expect(mesesEntreFechas("2026-01-01", null)).toBeNull();
    expect(mesesEntreFechas(undefined, undefined)).toBeNull();
    expect(mesesEntreFechas("", "2026-02-01")).toBeNull();
  });

  it("un egreso anterior al ingreso es un dato mal cargado, no una antigüedad negativa", () => {
    expect(mesesEntreFechas("2026-05-01", "2026-01-01")).toBeNull();
  });

  it("tolera un timestamp completo", () => {
    expect(mesesEntreFechas("2025-01-10T00:00:00Z", "2026-01-10T00:00:00Z")).toBe(12);
  });
});

describe("anioDeBaja", () => {
  it("se imputa al año del egreso", () => {
    expect(anioDeBaja("2026-06-18", 2030)).toBe(2026);
    expect(anioDeBaja("2025-12-31", 2030)).toBe(2025);
  });

  it("sin fecha cae en el año que se le pase", () => {
    expect(anioDeBaja(null, 2026)).toBe(2026);
    expect(anioDeBaja("", 2026)).toBe(2026);
    expect(anioDeBaja("basura", 2026)).toBe(2026);
  });
});

describe("cuentaParaRotacion", () => {
  it("los fleteros no entran en el índice", () => {
    // Bárbara, 31/08/2026: "hay 14 que igual dos son fleteros, no cuentan".
    // Son terceros contratados, no nómina.
    expect(cuentaParaRotacion("fletero")).toBe(false);
  });

  it("el resto del personal sí", () => {
    expect(cuentaParaRotacion("chofer")).toBe(true);
    expect(cuentaParaRotacion("administrativo")).toBe(true);
    expect(cuentaParaRotacion("mantenimiento")).toBe(true);
    // Sin rol cargado se asume chofer, que es el default del legajo.
    expect(cuentaParaRotacion(null)).toBe(true);
    expect(cuentaParaRotacion(undefined)).toBe(true);
  });
});
