import { describe, it, expect } from "vitest";
import { eventoCuentaSeguridad, eventoCuentaConducta } from "./criterios";

describe("clasificación de eventos manuales del chofer", () => {
  it("apercibimiento y multa pesan en Seguridad, no en Conducta", () => {
    for (const tipo of ["apercibimiento", "multa"]) {
      expect(eventoCuentaSeguridad(tipo)).toBe(true);
      expect(eventoCuentaConducta(tipo)).toBe(false);
    }
  });

  it("llamado de atención y adelanto pesan en Conducta, no en Seguridad", () => {
    for (const tipo of ["llamado_atencion", "adelanto"]) {
      expect(eventoCuentaConducta(tipo)).toBe(true);
      expect(eventoCuentaSeguridad(tipo)).toBe(false);
    }
  });

  it("tipo nulo/desconocido cae a Seguridad (compat. con filas viejas)", () => {
    expect(eventoCuentaSeguridad(null)).toBe(true);
    expect(eventoCuentaSeguridad(undefined)).toBe(true);
    expect(eventoCuentaConducta(null)).toBe(false);
  });
});
