import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import KpiPeriodo from "./KpiPeriodo";
import type { TotalesPeriodo } from "@/app/(dashboard)/choferes/ranking/lib";

/**
 * La fila de números del dashboard.
 *
 * Lo que se rompió una vez y no puede volver a pasar: que el total de un período
 * de tres meses sea, en realidad, el de un mes —porque a los otros dos nadie les
 * cargó los montos— y que la pantalla no lo diga (jun–ago 2026: $1.466,9 M que
 * eran íntegros de junio). Y que el $/km se muestre redondeado a "$ 2 k".
 */

const serie: TotalesPeriodo["serie"] = Array.from({ length: 16 }, () => ({
  desde: "2026-06-01",
  hasta: "2026-06-05",
  viajes: 100,
  kmConCarga: 50000,
  kmVacios: 20000,
  toneladas: 1200,
  facturacion: 90_000_000,
}));

function totales(over: Partial<TotalesPeriodo> = {}): TotalesPeriodo {
  return {
    viajes: 1809,
    choferesActivos: 64,
    kmConCarga: 561_389,
    kmVacios: 307_635,
    toneladas: 19_125,
    facturacion: 1_466_862_324,
    serie,
    mesesSinFacturacion: [],
    ...over,
  };
}

afterEach(() => cleanup());

describe("KpiPeriodo", () => {
  it("avisa de qué meses salió la facturación cuando falta cargar alguno", () => {
    render(
      <KpiPeriodo
        totales={totales({ mesesSinFacturacion: ["2026-07", "2026-08"] })}
        periodoLabel="Últimos 3 meses"
        mostrarFacturacion
      />,
    );
    expect(screen.getByText(/julio y agosto todavía están en \$ 0/)).toBeTruthy();
  });

  it("nombra los meses de a uno, de a dos y en montón", () => {
    const { rerender } = render(
      <KpiPeriodo totales={totales({ mesesSinFacturacion: ["2026-07"] })} periodoLabel="p" mostrarFacturacion />,
    );
    expect(screen.getByText(/julio todavía está en \$ 0/)).toBeTruthy();

    rerender(
      <KpiPeriodo
        totales={totales({ mesesSinFacturacion: ["2026-05", "2026-06", "2026-07", "2026-08"] })}
        periodoLabel="p"
        mostrarFacturacion
      />,
    );
    expect(screen.getByText(/mayo, junio y 2 meses más/)).toBeTruthy();
  });

  it("con todos los meses cargados no mete un aviso de la nada", () => {
    render(<KpiPeriodo totales={totales()} periodoLabel="Junio 2026" mostrarFacturacion />);
    expect(screen.queryByText(/en \$ 0/)).toBeNull();
  });

  it("el $/km va con todos sus dígitos, no redondeado al millar", () => {
    render(
      <KpiPeriodo totales={totales()} periodoLabel="Últimos 3 meses" mostrarFacturacion />,
    );
    // 1.466.862.324 / (561.389 + 307.635) = 1.688 por km
    expect(screen.getByText("$ 1.688 por km")).toBeTruthy();
    expect(screen.queryByText(/\$ 2 k por km/)).toBeNull();
  });

  it("sin permiso de facturación no se ve ni el monto, ni el aviso, ni el candado", () => {
    render(
      <KpiPeriodo
        totales={totales({ mesesSinFacturacion: ["2026-07", "2026-08"] })}
        periodoLabel="Últimos 3 meses"
        mostrarFacturacion={false}
      />,
    );
    expect(screen.getByText("19.125 t")).toBeTruthy();
    expect(screen.queryByText(/1\.466,9 M/)).toBeNull();
    expect(screen.queryByText(/Sólo la ve la dirección/)).toBeNull();
    expect(screen.queryByText(/en \$ 0/)).toBeNull();
  });

  it("le dice a la dirección que ese número no lo ve el resto", () => {
    render(<KpiPeriodo totales={totales()} periodoLabel="Junio 2026" mostrarFacturacion />);
    expect(screen.getByText("Sólo la ve la dirección")).toBeTruthy();
  });
});
