import { describe, it, expect } from "vitest";
import { novedadesRecientes, NOVEDADES, type Novedad } from "./novedades";

const LISTA: Novedad[] = [
  { fecha: "2026-08-10", titulo: "de hoy" },
  { fecha: "2026-08-06", titulo: "de hace cuatro días" },
  { fecha: "2026-07-20", titulo: "del mes pasado" },
  { fecha: "2026-08-31", titulo: "del futuro (typo al cargarla)" },
];

describe("novedadesRecientes", () => {
  it("trae solo las de la ventana, de la más nueva a la más vieja", () => {
    expect(novedadesRecientes("2026-08-10", 10, LISTA).map((n) => n.titulo)).toEqual([
      "de hoy",
      "de hace cuatro días",
    ]);
  });

  it("no muestra novedades con fecha futura", () => {
    // Una fecha mal tipeada no puede quedar clavada arriba de todo para siempre.
    expect(novedadesRecientes("2026-08-10", 365, LISTA).map((n) => n.titulo)).not.toContain(
      "del futuro (typo al cargarla)",
    );
  });

  it("incluye el borde exacto de la ventana", () => {
    expect(novedadesRecientes("2026-08-10", 4, LISTA).map((n) => n.titulo)).toContain(
      "de hace cuatro días",
    );
    expect(novedadesRecientes("2026-08-10", 3, LISTA).map((n) => n.titulo)).not.toContain(
      "de hace cuatro días",
    );
  });

  it("en una semana sin cambios no devuelve nada", () => {
    expect(novedadesRecientes("2026-12-01", 10, LISTA)).toEqual([]);
  });

  it("aguanta una fecha inválida sin romper el pop-up", () => {
    expect(novedadesRecientes("", 10, LISTA)).toEqual([]);
  });

  it("las novedades cargadas tienen fecha ISO y título", () => {
    // Barata pero atrapa el error real: agregar un renglón con la fecha en
    // formato argentino rompe el orden y la ventana sin avisar.
    for (const n of NOVEDADES) {
      expect(n.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.titulo.trim().length).toBeGreaterThan(0);
    }
  });
});
