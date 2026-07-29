import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChoferVacacionesTab from "./ChoferVacacionesTab";
import type { Ausencia, VacacionesSaldo } from "./types";

const editarAusenciaAction = vi.fn(async () => ({ success: true }));
const cancelarAusenciaAction = vi.fn(async () => ({ success: true }));

vi.mock("./actions", () => ({
  guardarSaldosAnioAction: vi.fn(async () => ({ success: true })),
  reimputarPeriodoAction: vi.fn(async () => ({ success: true })),
  crearAusenciaAction: vi.fn(async () => ({ success: true })),
  getViajesChoferEnRangoAction: vi.fn(async () => []),
  historialAnioAction: vi.fn(async () => []),
  editarAusenciaAction: (...args: unknown[]) => editarAusenciaAction(...(args as [])),
  cancelarAusenciaAction: (...args: unknown[]) => cancelarAusenciaAction(...(args as [])),
}));

beforeEach(() => {
  editarAusenciaAction.mockClear();
  cancelarAusenciaAction.mockClear();
});

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

function montar(extra?: Partial<VacacionesSaldo>, canWrite = true, ingreso = `${Y - 1}-02-01`) {
  return render(
    <ChoferVacacionesTab
      chofer_id="c1"
      saldo={{ ...saldoHeim, ...extra }}
      ausencias={[periodoHeim]}
      can_write={canWrite}
      fecha_ingreso={ingreso}
      onRefresh={vi.fn()}
    />,
  );
}

/** Celdas de texto de una fila de la tabla de "Días por año". */
const celdas = (fila: Element) => [...fila.querySelectorAll("td")].map((c) => c.textContent);

describe("ChoferVacacionesTab — saldo", () => {
  it("no vuelve a restar los días ya imputados a otro año", () => {
    montar();
    // Los 11 días están imputados al año pasado, así que el año en curso sigue
    // entero: la cuenta escrita y la tarjeta tienen que decir lo mismo.
    expect(screen.getByText(/le tocan/).textContent).toContain(
      `del ${Y} le tocan 14 y no se tomó ninguno`,
    );
    expect(screen.getByText(`Corresponden ${Y}`).parentElement!).toHaveTextContent("14");
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
    const { container } = montar();
    const filas = container.querySelectorAll("tbody tr");
    expect(filas).toHaveLength(2);
    // Mismas columnas que el editor: Año / Corresponden / Tomó / Queda.
    expect(celdas(filas[0]!).slice(0, 4)).toEqual([`${Y - 1}`, "11", "11", "0"]);
    expect(celdas(filas[1]!).slice(0, 4)).toEqual([`${Y}`, "14", "0", "14"]);
  });

  it("avisa aparte de los días ya vencidos y los marca como tales en la tabla", () => {
    const { container } = montar({
      dias_vencidos: 5,
      anios: [
        { anio: Y - 2, otorgados: 5, usados: 0, saldo: 5, observaciones: null },
        ...saldoHeim.anios,
      ],
    });
    expect(screen.getByText(/día\(s\) de años anteriores/).textContent).toContain("5 día(s)");
    // Un año vencido no muestra saldo: dice "vencido" (antes iba tachado).
    const filas = container.querySelectorAll("tbody tr");
    expect(celdas(filas[0]!).slice(0, 4)).toEqual([`${Y - 2}`, "5", "0", "vencido"]);
  });

  // Pedido de Bárbara (29/07/2026): "por ahí esos dos datos se podrían sacar".
  it("no muestra las tarjetas de Tomados ni Disponibles", () => {
    montar();
    expect(screen.queryByText("Tomados")).not.toBeInTheDocument();
    expect(screen.queryByText("Disponibles")).not.toBeInTheDocument();
  });

  // "Yo ahora le adeudo 3 (…) eso me puso menos 15": un negativo no es un saldo,
  // es una inconsistencia. Se muestra 0 y el sobregiro se explica aparte.
  it("nunca muestra los adeudados en negativo: dice 0 y explica el sobregiro", () => {
    montar({ dias_adeudados: -15 });
    expect(screen.getByText(`Adeudados ${Y - 1}`).parentElement!).toHaveTextContent("0");
    expect(screen.getByText(new RegExp(`15 días imputados al ${Y - 1} de más`))).toBeInTheDocument();
  });

  // "¿Eso se va a ir actualizando solo? Es re importante." Ahora está escrito.
  it("explica la antigüedad y nombra el año en que le cambian los días", () => {
    // Ingresó hace 4 años: al 31/12 de este año le tocan 14, y al del siguiente
    // cruza los 5 años y pasa a 21.
    montar(undefined, true, `${Y - 4}-03-01`);
    const frase = screen.getByText(/Ingresó el/).textContent!;
    expect(frase).toContain(`Al 31/12/${Y} cumple 4 años → 14 días`);
    expect(frase).toContain(`Al 31/12/${Y + 1} cumple 5 y pasa a 21`);
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

    // 18 otorgados − 11 usados = 7 adeudados.
    expect(screen.getByText(`Adeudados ${Y - 1}`).parentElement!).toHaveTextContent("7");
  });

  // El error de Bárbara: leyó "sin tomar" (la columna de al lado) como si fuera
  // el rótulo del input de días. Esa cadena no puede existir en el editor.
  it("el editor no dice «sin tomar» en ningún lado", () => {
    const { container } = montar();
    fireEvent.click(screen.getByText("Editar días"));
    expect(container.textContent).not.toContain("sin tomar");
    // En su lugar hay encabezados de verdad, alineados con cada campo.
    expect(screen.getByText("Días que le corresponden")).toBeInTheDocument();
    expect(screen.getByText("Ya se tomó")).toBeInTheDocument();
    expect(screen.getByText("Queda")).toBeInTheDocument();
  });

  it("no deja guardar un año que quedaría en negativo y explica el número correcto", () => {
    montar({
      anios: [
        { anio: Y - 1, otorgados: 21, usados: 18, saldo: 3, observaciones: null },
        { anio: Y, otorgados: 14, usados: 0, saldo: 14, observaciones: null },
      ],
    });
    fireEvent.click(screen.getByText("Editar días"));
    // Lo que hizo ella: escribir el saldo pendiente donde va el total del año.
    fireEvent.change(screen.getAllByLabelText("Días que corresponden")[0]!, {
      target: { value: "3" },
    });

    const aviso = screen.getByText(/quedaría en -15/).textContent!;
    expect(aviso).toContain("ya tiene 18 imputados a ese año");
    expect(aviso).toContain("el número de esta columna es 21");
    expect(screen.getByText("Guardar")).toBeDisabled();
    expect(screen.getByText(`Revisá el ${Y - 1} antes de guardar.`)).toBeInTheDocument();
  });

  // Los días de un año se miden con la antigüedad al 31/12 DE ESE AÑO: agregar
  // el año anterior proponía los días del año en curso.
  it("propone los días del año que se agrega, no los del año en curso", () => {
    // Ingreso hace 5 años: al 31/12 del año pasado tenía 4 (14 días) y este año
    // cumple 5 (21 días).
    montar(
      { anios: [{ anio: Y, otorgados: 21, usados: 0, saldo: 21, observaciones: null }] },
      true,
      `${Y - 5}-03-01`,
    );
    fireEvent.click(screen.getByText("Editar días"));
    fireEvent.click(screen.getByText("Agregar año"));
    const inputs = screen.getAllByLabelText("Días que corresponden") as HTMLInputElement[];
    expect(inputs[1]!.value).toBe("14"); // el año pasado, no los 21 de este
  });

  // El aviso de "le faltan días" tiene que ser accionable, no sólo informativo.
  it("ofrece poner los días de ley cuando faltan", () => {
    montar({
      anios: [
        { anio: Y - 1, otorgados: 11, usados: 0, saldo: 11, observaciones: null },
        { anio: Y, otorgados: 14, usados: 0, saldo: 14, observaciones: null },
      ],
    });
    expect(
      screen.getByText(new RegExp(`Tiene 11 días cargados para el ${Y - 1}`)),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Poner 14"));
    const inputs = screen.getAllByLabelText("Días que corresponden") as HTMLInputElement[];
    expect(inputs[0]!.value).toBe("14");
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
    expect(screen.queryByTitle("Corregir las fechas de este período")).not.toBeInTheDocument();
  });
});

// Pedido de Bárbara (29/07/2026): las fechas de un período mal cargado sólo se
// podían tocar desde la pestaña Ausencias, así que el error se veía en un lado y
// se arreglaba en otro. Ahora se corrigen en la misma lista donde se leen.
describe("ChoferVacacionesTab — corregir fechas del período", () => {
  it("abre los campos de fecha y recalcula los días antes de guardar", () => {
    montar();
    fireEvent.click(screen.getByTitle("Corregir las fechas de este período"));

    const desde = screen.getByLabelText("Desde") as HTMLInputElement;
    const hasta = screen.getByLabelText("Hasta") as HTMLInputElement;
    expect(desde.value).toBe(`${Y}-07-20`);
    expect(hasta.value).toBe(`${Y}-07-30`);

    // Del 30/03 al 05/04 son 7 días: el conteo es inclusivo, igual que el server.
    fireEvent.change(desde, { target: { value: `${Y}-03-30` } });
    fireEvent.change(hasta, { target: { value: `${Y}-04-05` } });
    expect(screen.getByText("7 días")).toBeInTheDocument();
  });

  it("guarda las fechas nuevas sin cambiar de qué año descuenta", async () => {
    montar();
    fireEvent.click(screen.getByTitle("Corregir las fechas de este período"));
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: `${Y}-07-26` } });
    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(editarAusenciaAction).toHaveBeenCalled());
    const [id, choferId, data] = editarAusenciaAction.mock.calls.at(-1) as unknown as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("a1");
    expect(choferId).toBe("c1");
    expect(data.fecha_inicio).toBe(`${Y}-07-20`);
    expect(data.fecha_fin).toBe(`${Y}-07-26`);
    expect(data.es_vacaciones).toBe(true);
    // Mover fechas no reimputa: el año de cargo se conserva solo.
    expect(data.anio_cargo).toBeUndefined();
  });

  it("no deja guardar un período que termina antes de empezar", async () => {
    montar();
    fireEvent.click(screen.getByTitle("Corregir las fechas de este período"));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: `${Y}-08-10` } });
    fireEvent.click(screen.getByText("Guardar"));

    expect(screen.getByText("La fecha de fin no puede ser anterior al inicio.")).toBeInTheDocument();
    expect(editarAusenciaAction).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de cancelar un período y avisa a qué saldo vuelven los días", () => {
    montar();
    fireEvent.click(screen.getByTitle("Cancelar este período (los días vuelven al saldo)"));
    expect(screen.getByText("Cancelar período de vacaciones")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`vuelven al saldo ${Y - 1}`))).toBeInTheDocument();
  });
});
