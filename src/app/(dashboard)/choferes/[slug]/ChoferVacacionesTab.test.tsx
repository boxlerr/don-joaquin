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

function montar(
  extra?: Partial<VacacionesSaldo>,
  canWrite = true,
  ausencias: Ausencia[] = [periodoHeim],
) {
  return render(
    <ChoferVacacionesTab
      chofer_id="c1"
      saldo={{ ...saldoHeim, ...extra }}
      ausencias={ausencias}
      can_write={canWrite}
      fecha_ingreso={`${Y - 1}-02-01`}
      onRefresh={vi.fn()}
    />,
  );
}

describe("ChoferVacacionesTab — saldo", () => {
  it("no vuelve a restar los días ya imputados a otro año", () => {
    montar();
    // Los 11 días están imputados al año pasado, así que el año en curso sigue
    // entero: la cuenta escrita tiene que decirlo.
    expect(screen.getByText(/le tocan/).textContent).toContain(
      `del ${Y} le tocan 14 y no se tomó ninguno`,
    );
  });

  // Pedido de Bárbara (29/07/2026): "tomados me confunde, no me importa cuántos
  // días ya se tomó; y disponibles también es medio confuso".
  it("muestra sólo Corresponden y Adeudados", () => {
    montar();
    expect(screen.getByText(`Corresponden (${Y})`)).toBeInTheDocument();
    expect(screen.getByText(`Adeudados (${Y - 1})`)).toBeInTheDocument();
    expect(screen.queryByText("Tomados")).not.toBeInTheDocument();
    expect(screen.queryByText("Disponibles")).not.toBeInTheDocument();
  });

  // El "−15" que asustó a Bárbara: no es un saldo, es un error de carga.
  it("no muestra adeudados en negativo: pone 0 y explica qué corregir", () => {
    montar({
      dias_adeudados: -15,
      anios: [
        { anio: Y - 1, otorgados: 3, usados: 18, saldo: -15, observaciones: null },
        { anio: Y, otorgados: 21, usados: 0, saldo: 21, observaciones: null },
      ],
    });
    expect(screen.getByText(`Adeudados (${Y - 1})`).parentElement!).toHaveTextContent("0");
    const aviso = screen.getByText(/Falta corregir/).parentElement!;
    expect(aviso).toHaveTextContent(`Falta corregir el ${Y - 1}`);
    expect(aviso).toHaveTextContent("Se le imputaron 18 días y tiene 3 cargados");
    // Y la cuenta de abajo tampoco escribe el negativo.
    expect(screen.getByText(/le tocaban/).textContent).toContain(
      `del ${Y - 1} le tocaban 3 y ya se tomó 18, se pasó por 15`,
    );
  });

  it("explica por escrito de dónde sale el saldo (caso Cancela)", () => {
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

  it("muestra cada año como lo que le queda sobre el total, con barra", () => {
    montar();
    // Antes era un chip cifrado ("2025: 0 de 11 (usados 11)"). Ahora se lee el
    // saldo grande y el total al lado; lo tomado lo dice la barra.
    expect(screen.getByText(`de ${11}`)).toBeInTheDocument(); // año pasado: 0 de 11
    expect(screen.getByText(`de ${14}`)).toBeInTheDocument(); // año en curso: 14 de 14
    // La barra se llena sólo con lo que le queda: el año pasado va en cero y el
    // año en curso entero.
    expect(screen.getByTitle("No le queda ninguno de los 11")).toBeInTheDocument();
    expect(screen.getByTitle("Le quedan 14 de 14")).toBeInTheDocument();
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
    // Un año ya vencido NO se lista en "Días por año": su saldo siempre sería 0
    // y con el tiempo la lista se llena de años muertos. Lo que quedó sin gozar
    // lo sigue diciendo el aviso de arriba.
    expect(screen.queryByText(String(Y - 2))).not.toBeInTheDocument();
    expect(screen.queryByText(`venció el 31/12/${Y - 1}`)).not.toBeInTheDocument();
    // Pero el año anterior y el actual siguen estando.
    expect(screen.getByText(String(Y - 1))).toBeInTheDocument();
    expect(screen.getByText(String(Y))).toBeInTheDocument();
  });

  it("sigue mostrando los períodos tomados de un año ya vencido", () => {
    // Los días vencen, el historial no: lo que se tomó tiene que quedar visible
    // en "Vacaciones cargadas" aunque su año ya no figure arriba.
    montar(
      {
        dias_vencidos: 5,
        anios: [
          { anio: Y - 2, otorgados: 5, usados: 5, saldo: 0, observaciones: null },
          ...saldoHeim.anios,
        ],
      },
      true,
      [{ ...periodoHeim, id: "viejo", anio_cargo: Y - 2 }],
    );
    expect(screen.queryByText(String(Y - 2))).not.toBeInTheDocument();
    expect(screen.getByText(`Del saldo ${Y - 2}`)).toBeInTheDocument();
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
    expect(screen.getByText(`Adeudados (${Y - 1})`).parentElement!).toHaveTextContent("7");
  });

  it("deja cambiar de qué año descuenta un período", () => {
    montar();
    fireEvent.click(screen.getByTitle("Cambiar de qué año descuenta este período"));
    // Se abre el desplegable estilado del sistema, con el año actual del período
    // como valor. (Las opciones sólo existen en el DOM al desplegarlo, y eso no se
    // puede accionar sin user-event.)
    expect(screen.getByText(`Descuenta del ${Y - 1}`)).toBeInTheDocument();
    expect(screen.getByTitle("Cancelar")).toBeInTheDocument();
  });

  it("sin permiso de escritura no ofrece editar nada", () => {
    montar(undefined, false);
    expect(screen.queryByText("Editar días")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Cambiar de qué año descuenta este período")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Corregir las fechas")).not.toBeInTheDocument();
  });
});

// Pedido de Bárbara (29/07/2026): las fechas de un período mal cargado sólo se
// podían tocar desde la pestaña Ausencias, así que el error se veía en un lado y
// se arreglaba en otro. Ahora se corrigen en la misma lista donde se leen.
describe("ChoferVacacionesTab — corregir fechas del período", () => {
  it("abre los campos de fecha y recalcula los días antes de guardar", () => {
    montar();
    fireEvent.click(screen.getByTitle("Corregir las fechas"));

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
    fireEvent.click(screen.getByTitle("Corregir las fechas"));
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
    fireEvent.click(screen.getByTitle("Corregir las fechas"));
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

// Un egresado dejó de acumular: el legajo le seguía mostrando saldo del año en
// curso, "vence el 31/12", próximo hito y el botón para cargarle vacaciones
// nuevas, como si siguiera trabajando.
describe("chofer egresado", () => {
  const montarEgresado = () =>
    render(
      <ChoferVacacionesTab
        chofer_id="c1"
        saldo={saldoHeim}
        ausencias={[periodoHeim]}
        can_write
        fecha_ingreso={`${Y - 1}-02-01`}
        egresado
        fecha_egreso={`${Y}-08-15`}
        onRefresh={vi.fn()}
      />,
    );

  it("dice que está egresado y cuántos días se tomó, sin tarjetas de saldo", () => {
    montarEgresado();
    expect(screen.getByText(/Egresado el 15\/08/)).toBeInTheDocument();
    expect(screen.getByText(/No acumula más vacaciones/)).toBeInTheDocument();
    expect(screen.getByText(/Se tomó 11 días en 1 período/)).toBeInTheDocument();
    expect(screen.queryByText(`Corresponden (${Y})`)).not.toBeInTheDocument();
    expect(screen.queryByText(`Adeudados (${Y - 1})`)).not.toBeInTheDocument();
  });

  it("no muestra hitos, vencimientos ni el saldo por año", () => {
    montarEgresado();
    expect(screen.queryByText("Próximo hito")).not.toBeInTheDocument();
    expect(screen.queryByText("Vence saldo anterior")).not.toBeInTheDocument();
    expect(screen.queryByText("Antigüedad")).not.toBeInTheDocument();
    expect(screen.queryByText("Días por año")).not.toBeInTheDocument();
    expect(screen.queryByText(`vence el 31/12/${Y}`)).not.toBeInTheDocument();
  });

  it("no deja cargarle vacaciones nuevas pero conserva el historial", () => {
    montarEgresado();
    expect(screen.queryByText("Cargar vacaciones")).not.toBeInTheDocument();
    expect(screen.queryByText("Editar días")).not.toBeInTheDocument();
    // El historial sigue entero: es lo que hay que poder consultar.
    expect(screen.getByText("Vacaciones cargadas")).toBeInTheDocument();
    expect(screen.getByText(`Del saldo ${Y - 1}`)).toBeInTheDocument();
  });
});
