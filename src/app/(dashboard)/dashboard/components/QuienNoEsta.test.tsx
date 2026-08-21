import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import QuienNoEsta from "./QuienNoEsta";
import type { AusenciaProxima } from "@/app/(dashboard)/viajes/actions";

/**
 * La tarjeta "Quién no está" del dashboard (pedido de Julián, 21/08).
 *
 * Lo que no se puede romper: que el que HOY no está no quede tapado por los que
 * se van la semana que viene, y que se diga cuándo vuelve — es el dato con el
 * que se decide a quién se le da un viaje.
 */

function ausencia(over: Partial<AusenciaProxima> = {}): AusenciaProxima {
  return {
    id: "a1",
    chofer_id: "c1",
    chofer_nombre: "Schwindt, Jorge Fernando",
    tipo: "Vacaciones",
    es_vacaciones: true,
    fecha_aproximada: false,
    fecha_inicio: "2026-08-17",
    fecha_fin: "2026-08-23",
    autorizado_por_nombre: null,
    en_curso: true,
    dias_hasta_inicio: 0,
    fecha_regreso: "2026-08-24",
    ...over,
  };
}

afterEach(() => cleanup());

describe("QuienNoEsta", () => {
  it("dice quién está de vacaciones hoy y cuándo vuelve", () => {
    render(<QuienNoEsta ausencias={[ausencia()]} dias={14} puedeVerCronograma puedeVerLegajos />);

    expect(screen.getByText("Schwindt, Jorge Fernando")).toBeTruthy();
    expect(screen.getByText(/En vacaciones/)).toBeTruthy();
    expect(screen.getByText(/vuelve el lun 24 ago/)).toBeTruthy();
    expect(screen.getByText(/Hoy no están · 1/)).toBeTruthy();
  });

  it("separa a los que se van de los que ya no están", () => {
    render(
      <QuienNoEsta
        dias={14}
        puedeVerCronograma
        puedeVerLegajos
        ausencias={[
          ausencia(),
          ausencia({
            id: "a2",
            chofer_id: "c2",
            chofer_nombre: "Loyza, Gaston Nahuel",
            en_curso: false,
            dias_hasta_inicio: 9,
            fecha_inicio: "2026-08-30",
            fecha_fin: "2026-09-03",
            fecha_regreso: "2026-09-04",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/Se van en los próximos días · 1/)).toBeTruthy();
    expect(screen.getByText(/Se va en 9 días/)).toBeTruthy();
    expect(screen.getByText(/vacaciones · 30 ago – 3 sep/)).toBeTruthy();
  });

  it("con la flota entera de vacaciones muestra primero a los que faltan hoy", () => {
    const seVan = Array.from({ length: 10 }, (_, i) =>
      ausencia({
        id: `f${i}`,
        chofer_id: `f${i}`,
        chofer_nombre: `Futuro ${i}, Chofer`,
        en_curso: false,
        dias_hasta_inicio: i + 1,
        fecha_inicio: "2026-08-30",
        fecha_fin: "2026-09-03",
      }),
    );
    render(<QuienNoEsta ausencias={[ausencia(), ...seVan]} dias={14} puedeVerCronograma puedeVerLegajos />);

    // El que hoy no está entra siempre; del resto entran los que quedan hasta 6.
    expect(screen.getByText("Schwindt, Jorge Fernando")).toBeTruthy();
    expect(screen.getByText("Futuro 4, Chofer")).toBeTruthy();
    expect(screen.queryByText("Futuro 5, Chofer")).toBeNull();
    expect(screen.getByText(/Ver 5 más en el cronograma/)).toBeTruthy();
  });

  it("cuando no falta nadie lo dice, en vez de dejar el hueco", () => {
    render(<QuienNoEsta ausencias={[]} dias={14} puedeVerCronograma puedeVerLegajos />);
    expect(screen.getByText(/Hoy no falta nadie/)).toBeTruthy();
  });

  it("avisa cuando la fecha de regreso todavía es estimada", () => {
    render(<QuienNoEsta ausencias={[ausencia({ fecha_aproximada: true })]} dias={14} puedeVerCronograma puedeVerLegajos />);
    expect(screen.getByText(/vuelve el lun 24 ago \(estimado\)/)).toBeTruthy();
  });

  it("sin permiso de vacaciones no dibuja el botón del cronograma", () => {
    render(<QuienNoEsta ausencias={[ausencia()]} dias={14} puedeVerCronograma={false} puedeVerLegajos />);
    // La tarjeta se sigue viendo entera: lo único que desaparece es el botón
    // que llevaría a una pantalla que esa persona no puede abrir.
    expect(screen.getByText("Schwindt, Jorge Fernando")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ver vacaciones/ })).toBeNull();
  });

  it("sin permiso de legajos las fichas no son links", () => {
    render(
      <QuienNoEsta
        ausencias={[ausencia()]}
        dias={14}
        puedeVerCronograma={false}
        puedeVerLegajos={false}
      />,
    );
    expect(screen.getByText("Schwindt, Jorge Fernando")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
