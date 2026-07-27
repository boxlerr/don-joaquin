import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChoferVacacionesTab from "./ChoferVacacionesTab";
import type { Ausencia, VacacionesSaldo } from "./types";

vi.mock("./actions", () => ({
  guardarSaldosAnioAction: vi.fn(async () => ({ success: true })),
  reimputarPeriodoAction: vi.fn(async () => ({ success: true })),
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
}));

const Y = new Date().getFullYear();

// Caso real de producción (Heim, Jonatan — 27/07/2026): 11 días tomados este
// año pero imputados al saldo del año pasado. El legajo hacía
// corresponden + adeudados − tomados = 14 + 0 − 11 = 3, cuando le quedan los 14.
const saldoHeim: VacacionesSaldo = {
  dias_correspondientes: 14,
  dias_adeudados: 0,
  dias_tomados: 11,
  dias_disponibles: 14,
  dias_vencidos: 0,
  anios: [
    { anio: Y - 1, otorgados: 11, usados: 11, saldo: 0, observaciones: null },
    { anio: Y, otorgados: 14, usados: 0, saldo: 14, observaciones: null },
  ],
};

const periodoHeim: Ausencia = {
  id: "a1",
  tipo: "Vacaciones",
  fecha_inicio: `${Y}-07-20`,
  fecha_fin: `${Y}-07-30`,
  estado: "autorizada",
  observaciones: null,
  autorizado_por_nombre: null,
  dias: 11,
  en_curso: true,
  es_vacaciones: true,
  justificada: true,
  anio_cargo: Y - 1,
  created_at: `${Y}-07-01T00:00:00Z`,
};

function montar(extra?: Partial<VacacionesSaldo>, canWrite = true) {
  return render(
    <ChoferVacacionesTab
      chofer_id="c1"
      saldo={{ ...saldoHeim, ...extra }}
      ausencias={[periodoHeim]}
      can_write={canWrite}
      fecha_ingreso={`${Y - 1}-02-01`}
      onRefresh={vi.fn()}
    />,
  );
}

describe("ChoferVacacionesTab — saldo", () => {
  it("no vuelve a restar los días ya imputados a otro año", () => {
    montar();
    const disponibles = screen.getByText("Disponibles").parentElement!;
    expect(disponibles).toHaveTextContent("14"); // antes mostraba 3
    expect(screen.getByText("Tomados").parentElement!).toHaveTextContent("11");
  });

  it("explica por escrito de dónde sale disponibles (caso Cancela)", () => {
    // 2025: 7 otorgados, 7 usados → 0. 2026: 14 otorgados, 7 usados → 7.
    // "Corresponden 14" al lado de "Disponibles 7" se leía como un error.
    montar({
      dias_correspondientes: 14,
      dias_adeudados: 0,
      dias_tomados: 14,
      dias_disponibles: 7,
      anios: [
        { anio: Y - 1, otorgados: 7, usados: 7, saldo: 0, observaciones: null },
        { anio: Y, otorgados: 14, usados: 7, saldo: 7, observaciones: null },
      ],
    });
    const cuenta = screen.getByText(/le tocaban/);
    expect(cuenta.textContent).toContain(`del ${Y - 1} le tocaban 7 y ya se tomó 7, quedan 0`);
    expect(cuenta.textContent).toContain(`del ${Y} le tocaban 14 y ya se tomó 7, quedan 7`);
    expect(cuenta.textContent).toContain("En total le quedan 7 días");
  });

  it("muestra el desglose por año con lo usado de cada uno", () => {
    montar();
    expect(screen.getByText(`${Y - 1}: 0 de 11 (usados 11)`)).toBeInTheDocument();
    expect(screen.getByText(`${Y}: 14 de 14`)).toBeInTheDocument();
  });

  it("avisa aparte de los días ya vencidos, sin sumarlos a disponibles", () => {
    montar({
      dias_vencidos: 5,
      anios: [
        { anio: Y - 2, otorgados: 5, usados: 0, saldo: 5, observaciones: null },
        ...saldoHeim.anios,
      ],
    });
    expect(screen.getByText(/día\(s\) de años anteriores/).textContent).toContain("5 día(s)");
    expect(screen.getByText("Disponibles").parentElement!).toHaveTextContent("14");
  });
});

describe("ChoferVacacionesTab — edición", () => {
  it("permite editar los días de cualquier año y recalcula en vivo antes de guardar", () => {
    montar();
    fireEvent.click(screen.getByText("Editar días"));

    // Caso Cancela: el año pasado quedó con menos días de los que le tocaban.
    const inputs = screen.getAllByLabelText("Días que corresponden");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0]!, { target: { value: "18" } });

    // 18 otorgados − 11 usados = 7 adeudados, que suman a los 14 del año actual.
    expect(screen.getByText(`Adeudados (${Y - 1})`).parentElement!).toHaveTextContent("7");
    expect(screen.getByText("Disponibles").parentElement!).toHaveTextContent("21");
  });

  it("deja cambiar de qué año descuenta un período", () => {
    montar();
    fireEvent.click(screen.getByText(`Saldo ${Y - 1}`));
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    // Ofrece los años cargados y la opción de marcarlo como histórico.
    expect(screen.getByRole("option", { name: `Descuenta del ${Y}` })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Histórico (no descuenta)" })).toBeInTheDocument();
  });

  it("sin permiso de escritura no ofrece editar nada", () => {
    montar(undefined, false);
    expect(screen.queryByText("Editar días")).not.toBeInTheDocument();
    expect(screen.getByText(`Saldo ${Y - 1}`)).toBeDisabled();
  });
});
