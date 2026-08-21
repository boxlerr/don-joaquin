import { describe, it, expect } from "vitest";
import {
  cuandoSeVa,
  estadoAusente,
  fechaCorta,
  fechaCortaConDia,
  motivoAusencia,
} from "./ausencias-texto";

describe("ausencias-texto", () => {
  it("no corre el día por la zona horaria", () => {
    // `new Date("2026-08-24")` se lee en UTC y en Argentina cae el 23 a las 21hs:
    // el día de la semana salía uno para atrás ("dom 23" en vez de "lun 24").
    expect(fechaCortaConDia("2026-08-24")).toBe("lun 24 ago");
    expect(fechaCorta("2026-08-24")).toBe("24 ago");
    expect(fechaCorta("2026-01-01")).toBe("1 ene");
  });

  it("acepta la fecha con hora, como viene de la base", () => {
    expect(fechaCorta("2026-08-24T00:00:00")).toBe("24 ago");
  });

  it("dice cuándo se va sin hacer cuentas", () => {
    expect(cuandoSeVa(0)).toBe("hoy");
    expect(cuandoSeVa(1)).toBe("mañana");
    expect(cuandoSeVa(9)).toBe("en 9 días");
  });

  it("reconoce las vacaciones por la carga, no por cómo esté escrito el tipo", () => {
    // Un período importado puede tener cualquier texto en `tipo`; lo que manda
    // es la marca de vacaciones.
    expect(estadoAusente("Descanso anual", true)).toBe("En vacaciones");
    expect(estadoAusente("vacaciones")).toBe("En vacaciones");
    expect(estadoAusente("Licencia por enfermedad")).toBe("De licencia por enfermedad");
    expect(estadoAusente("Turno médico")).toBe("No está hoy · turno médico");
  });

  it("muestra el motivo tal cual lo escribieron", () => {
    expect(motivoAusencia("Carnet de conducir")).toBe("Carnet de conducir");
    expect(motivoAusencia("Descanso anual", true)).toBe("Vacaciones");
    expect(motivoAusencia("  ")).toBe("Sin motivo");
  });
});
