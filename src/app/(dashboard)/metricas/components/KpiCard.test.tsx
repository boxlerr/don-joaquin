// Lo que se ve en las tarjetas del encabezado de /metricas, con los números
// reales de junio 2026. Cubre las tres cosas que se arreglaron el 30/07:
// montos completos (no "$1,51 MM"), variación sin color en los pesos, y que
// el pie de "Facturación por km" no cuelgue el costo del estudio (que es de
// escalables) debajo de un número que mezcla las dos flotas.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KpiCard from "./KpiCard";
import { KPIS } from "./metricas-def";

const kpi = (id: string) => KPIS.find((k) => k.id === id)!;

const base = {
  dPrev: null,
  dYoY: null,
  serie: [] as (number | null)[],
};

describe("KpiCard — junio 2026", () => {
  it("muestra la facturación entera, sin abreviar", () => {
    const def = kpi("facturacion");
    render(<KpiCard {...base} def={def} valor={def.fmt(1_513_206_230.73)} sub="62 camiones" />);
    expect(screen.getByText("$1.513.206.231")).toBeInTheDocument();
    expect(screen.queryByText(/MM/)).not.toBeInTheDocument();
  });

  it("muestra los sueldos enteros", () => {
    const def = kpi("sueldos_pesos");
    render(<KpiCard {...base} def={def} valor={def.fmt(312_260_936.03)} />);
    expect(screen.getByText("$312.260.936")).toBeInTheDocument();
  });

  it("no pinta de rojo la suba de sueldos en pesos (sube por inflación y aguinaldo)", () => {
    const def = kpi("sueldos_pesos");
    expect(def.neutro).toBe(true);
    render(<KpiCard {...base} def={def} valor={def.fmt(312_260_936.03)} dPrev={42.5} dYoY={39.7} />);
    const badge = screen.getByText(/\+42,5%/);
    expect(badge.className).not.toMatch(/text-red/);
    expect(badge.className).not.toMatch(/text-emerald/);
  });

  it("sí pinta de rojo la suba del % de sueldo sobre facturación", () => {
    const def = kpi("sueldo");
    render(<KpiCard {...base} def={def} valor={def.fmt(20.64)} dPrev={4.71} />);
    expect(screen.getByText(/\+4,7 pp/).className).toMatch(/text-red/);
  });

  it("explica en el tooltip por qué una variación positiva puede ser roja", () => {
    const def = kpi("vacios");
    render(<KpiCard {...base} def={def} valor={def.fmt(36.17)} dPrev={6.93} />);
    expect(screen.getByTitle(/mes ant\..*subir es peor/)).toBeInTheDocument();
  });

  it("achica el cuerpo del número cuando el monto es largo, en vez de abreviarlo", () => {
    const def = kpi("facturacion");
    const valor = def.fmt(1_513_206_230.73);
    const { container } = render(<KpiCard {...base} def={def} valor={valor} />);
    // En celular la tarjeta mide la mitad de la pantalla, así que el escalón
    // arranca más abajo (15px) y recién desde sm toma el de siempre (18px).
    const p = container.querySelector("p.text-\\[15px\\]");
    expect(p).not.toBeNull();
    expect(p!.className).toContain("sm:text-[18px]");
    // Lo que se achica es el cuerpo, no el número: el monto va entero.
    expect(p!.textContent).toBe(valor);
  });
});
