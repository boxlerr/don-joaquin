import { describe, it, expect } from "vitest";
import { claveIdentidad, colorDePersona } from "./AvatarPersona";

/**
 * El avatar tiene que ser DE la persona, no de la pantalla.
 *
 * Cada pantalla arma el nombre a su manera: Vacaciones manda
 * "Miguel Angel Pittana", el listado de viajes "Pittana, Miguel Angel". El color
 * salía de hashear ese string tal cual, así que el mismo chofer aparecía con un
 * color distinto en cada lugar — parecía otra persona.
 */
describe("claveIdentidad", () => {
  it("EL BUG: el mismo chofer escrito de las dos formas es la misma persona", () => {
    expect(claveIdentidad("Pittana, Miguel Angel")).toBe(claveIdentidad("Miguel Angel Pittana"));
    expect(claveIdentidad("Fernandez, José Luis")).toBe(claveIdentidad("José Luis Fernandez"));
  });

  it("los acentos no parten a la persona en dos", () => {
    expect(claveIdentidad("José Luis Fernández")).toBe(claveIdentidad("Jose Luis Fernandez"));
  });

  it("la puntuación y los espacios de más no cuentan", () => {
    expect(claveIdentidad("  PAZ,   Leonardo ")).toBe(claveIdentidad("leonardo paz"));
    expect(claveIdentidad("D'Angelo, Ana")).toBe(claveIdentidad("Ana D Angelo"));
  });

  it("personas distintas siguen siendo distintas", () => {
    expect(claveIdentidad("Pittana, Miguel Angel")).not.toBe(claveIdentidad("Pittana, Eugenio Omar"));
  });

  it("un nombre vacío no rompe", () => {
    expect(claveIdentidad("")).toBe("");
    expect(claveIdentidad("   ")).toBe("");
  });
});

describe("colorDePersona", () => {
  it("mismo chofer, mismo color, no importa qué pantalla lo pida", () => {
    const enViajes = colorDePersona("Pittana, Miguel Angel");
    const enVacaciones = colorDePersona("Miguel Angel Pittana");
    const enElLegajo = colorDePersona("PITTANA, MIGUEL ANGEL");
    expect(enViajes).toBe(enVacaciones);
    expect(enViajes).toBe(enElLegajo);
  });

  it("siempre devuelve un color de la paleta", () => {
    for (const n of ["Paz, Leonardo", "Mehring, Leonel Eduardo", "", "X"]) {
      expect(colorDePersona(n)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("los cuatro choferes de Lomaser no caen todos en el mismo color", () => {
    const colores = new Set(
      [
        "Paz, Leonardo",
        "Mehring, Leonel Eduardo",
        "Randazzo, David Exequiel",
        "Pittana, Eugenio Omar",
      ].map(colorDePersona),
    );
    expect(colores.size).toBeGreaterThan(1);
  });
});
