import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import EditViajeDialog from "./EditViajeDialog";

/**
 * Bug reportado por Nico (31/07/2026): editó un viaje y le cambió el destino
 * (RAMALLO → LOMASER pasó a RAMALLO → PLANTA URIBURU) pero los km quedaron en
 * los 300 del destino viejo. El alta recalculaba los km del historial; el
 * diálogo de editar no lo hacía. Estos tests fijan ese comportamiento.
 */

vi.mock("../actions", () => ({
  getViajeParaEditarAction: vi.fn(),
  getViajeFormData: vi.fn(),
  getImporteSugeridoAction: vi.fn().mockResolvedValue(null),
  getKmHistoricoAction: vi.fn(),
  updateViajeAction: vi.fn().mockResolvedValue({ ok: true }),
}));

import {
  getViajeParaEditarAction,
  getViajeFormData,
  getKmHistoricoAction,
  updateViajeAction,
} from "../actions";

const mockViaje = getViajeParaEditarAction as ReturnType<typeof vi.fn>;
const mockFormData = getViajeFormData as ReturnType<typeof vi.fn>;
const mockKm = getKmHistoricoAction as ReturnType<typeof vi.fn>;
const mockUpdate = updateViajeAction as ReturnType<typeof vi.fn>;

const FORM_DATA = {
  clientes: [{ id: "cli-1", label: "YPF" }],
  choferes: [{ id: "cho-1", label: "PEREZ, Juan", camionId: "cam-1" }],
  camiones: [{ id: "cam-1", label: "AF696CR" }],
  tipos_carga: [{ id: "tc-1", label: "Cemento" }],
  puntos_ruta: [
    { id: "p-1", label: "RAMALLO" },
    { id: "p-2", label: "LOMASER" },
    { id: "p-3", label: "PLANTA URIBURU" },
  ],
  circuitos: [],
};

// El viaje tal como lo tenía Nico: RAMALLO → LOMASER, 300 km con carga.
const VIAJE_GUARDADO = {
  id: "v-1",
  codigo: "V-2026-02109",
  fecha_viaje: "2026-07-31",
  estado: "pendiente",
  facturado: false,
  cliente_id: "cli-1",
  chofer_id: "cho-1",
  camion_id: "cam-1",
  tipo_carga_id: "tc-1",
  ruta_id: null,
  origen_id: "p-1",
  origen_nombre: "RAMALLO",
  destino_id: "p-2",
  destino_nombre: "LOMASER",
  km_con_carga: 300,
  km_vacios: 0,
  ruta_via: null,
  tonelaje_real: 0,
  monto_flete: 0,
  tarifa_id: null,
  descripcion_otros: null,
  nro_viaje_ypf: "210062362",
  material: null,
  es_vacio: false,
};

const VIAJE_BASICO = {
  id: "v-1",
  codigo: "V-2026-02109",
  fecha_viaje: "2026-07-31",
  origen: "RAMALLO",
  destino: "LOMASER",
  km_totales: 300,
  facturado: false,
} as never;

const kmConCargaInput = () =>
  screen.getByText("Km con carga").parentElement!.querySelector("input")!;
const kmVaciosInput = () =>
  screen.getByText("Km vacíos").parentElement!.querySelector("input")!;
const montoInput = () =>
  screen.getByText("Monto de flete (ARS)").parentElement!.querySelector("input")!;

async function abrirDialogo() {
  render(
    <EditViajeDialog
      viaje={VIAJE_BASICO}
      open
      onOpenChange={() => {}}
      onSuccess={() => {}}
    />,
  );
  await waitFor(() => expect(kmConCargaInput()).toHaveValue(300));
}

/** Cambia el texto del campo de lugar (como si se tipeara a mano). */
function tipearLugar(label: string, texto: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value: texto } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockViaje.mockResolvedValue(VIAJE_GUARDADO);
  mockFormData.mockResolvedValue(FORM_DATA);
  mockKm.mockResolvedValue(null);
  mockUpdate.mockResolvedValue({ ok: true });
});

describe("EditViajeDialog — km al cambiar la ruta", () => {
  it("abrir el diálogo no toca los km guardados", async () => {
    await abrirDialogo();
    // Un rato largo para que corra el debounce del autocompletado.
    await new Promise((r) => setTimeout(r, 500));
    expect(kmConCargaInput()).toHaveValue(300);
    expect(mockKm).not.toHaveBeenCalled();
  });

  it("cambiar el destino recalcula los km del historial del par nuevo", async () => {
    mockKm.mockResolvedValue({ distancia: 140 });
    await abrirDialogo();

    tipearLugar("Destino", "ESCOBAR");

    await waitFor(() => expect(kmConCargaInput()).toHaveValue(140));
    expect(mockKm).toHaveBeenCalledWith("RAMALLO", "ESCOBAR", null);
  });

  it("destino sin historial: los km no quedan con los de la ruta anterior", async () => {
    // RAMALLO → PLANTA URIBURU no tiene ningún viaje con km cargados.
    mockKm.mockResolvedValue(null);
    await abrirDialogo();

    tipearLugar("Destino", "PLANTA URIBURU");

    await waitFor(() => expect(kmConCargaInput()).toHaveValue(0));
    expect(kmVaciosInput()).toHaveValue(0);
    expect(
      screen.getByText(/Sin historial de RAMALLO → PLANTA URIBURU/),
    ).toBeInTheDocument();
  });

  it("los km editados a mano le ganan al historial", async () => {
    mockKm.mockResolvedValue({ distancia: 140 });
    await abrirDialogo();

    fireEvent.change(kmConCargaInput(), { target: { value: "412" } });
    tipearLugar("Destino", "ESCOBAR");

    await new Promise((r) => setTimeout(r, 500));
    expect(kmConCargaInput()).toHaveValue(412);
  });

  it("volver al destino original restaura los km con los que se abrió", async () => {
    mockKm.mockResolvedValue({ distancia: 140 });
    await abrirDialogo();

    tipearLugar("Destino", "ESCOBAR");
    await waitFor(() => expect(kmConCargaInput()).toHaveValue(140));

    tipearLugar("Destino", "LOMASER");
    await waitFor(() => expect(kmConCargaInput()).toHaveValue(300));
  });

  // El primer arreglo mandaba SIEMPRE la distancia a "km con carga". En un tramo
  // vacío eso movía los km de columna y la hoja de ruta los contaba mal.
  it("en un viaje vacío, los km recalculados van a km vacíos", async () => {
    mockViaje.mockResolvedValue({
      ...VIAJE_GUARDADO,
      es_vacio: true,
      km_con_carga: 0,
      km_vacios: 95,
    });
    mockKm.mockResolvedValue({ distancia: 60 });
    render(
      <EditViajeDialog viaje={VIAJE_BASICO} open onOpenChange={() => {}} onSuccess={() => {}} />,
    );
    await waitFor(() => expect(kmVaciosInput()).toHaveValue(95));

    tipearLugar("Destino", "SAN NICOLAS");

    await waitFor(() => expect(kmVaciosInput()).toHaveValue(60));
    expect(kmConCargaInput()).toHaveValue(0);
  });
});

describe("EditViajeDialog — cargado vs vacío", () => {
  it("marcar vacío mueve la distancia a km vacíos y apaga la plata", async () => {
    await abrirDialogo();
    fireEvent.change(montoInput(), { target: { value: "250000" } });

    fireEvent.click(screen.getByRole("button", { name: "Vacío" }));

    expect(kmVaciosInput()).toHaveValue(300);
    expect(kmConCargaInput()).toHaveValue(0);
    expect(montoInput()).toHaveValue(0);
    expect(screen.getByText(/no se facturan/)).toBeInTheDocument();
  });

  it("desmarcar vacío devuelve la distancia a km con carga", async () => {
    mockViaje.mockResolvedValue({
      ...VIAJE_GUARDADO,
      es_vacio: true,
      km_con_carga: 0,
      km_vacios: 95,
    });
    render(
      <EditViajeDialog viaje={VIAJE_BASICO} open onOpenChange={() => {}} onSuccess={() => {}} />,
    );
    await waitFor(() => expect(kmVaciosInput()).toHaveValue(95));

    fireEvent.click(screen.getByRole("button", { name: "Con carga" }));

    expect(kmConCargaInput()).toHaveValue(95);
    expect(kmVaciosInput()).toHaveValue(0);
  });

  it("guarda es_vacio (antes el editar nunca lo escribía)", async () => {
    await abrirDialogo();
    fireEvent.click(screen.getByRole("button", { name: "Vacío" }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      es_vacio: true,
      km_vacios: 300,
      km_con_carga: 0,
      monto_flete: 0,
    });
  });
});

describe("EditViajeDialog — lo que devuelve a la tabla", () => {
  it("manda facturado al cargar el monto, para que la fila no se contradiga", async () => {
    const onSuccess = vi.fn();
    render(
      <EditViajeDialog viaje={VIAJE_BASICO} open onOpenChange={() => {}} onSuccess={onSuccess} />,
    );
    await waitFor(() => expect(kmConCargaInput()).toHaveValue(300));

    fireEvent.change(montoInput(), { target: { value: "850000" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      monto_flete: 850000,
      facturado: true,
      es_vacio: false,
    });
  });

  it("un vacío con monto NO queda facturado", async () => {
    const onSuccess = vi.fn();
    render(
      <EditViajeDialog viaje={VIAJE_BASICO} open onOpenChange={() => {}} onSuccess={onSuccess} />,
    );
    await waitFor(() => expect(kmConCargaInput()).toHaveValue(300));

    fireEvent.change(montoInput(), { target: { value: "850000" } });
    fireEvent.click(screen.getByRole("button", { name: "Vacío" }));
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0][0]).toMatchObject({ facturado: false, es_vacio: true });
  });

  it("manda el material corregido (antes la fila seguía con el viejo)", async () => {
    const onSuccess = vi.fn();
    render(
      <EditViajeDialog viaje={VIAJE_BASICO} open onOpenChange={() => {}} onSuccess={onSuccess} />,
    );
    await waitFor(() => expect(kmConCargaInput()).toHaveValue(300));

    fireEvent.change(screen.getByPlaceholderText(/Cemento, Clinker/), {
      target: { value: "Clinker" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0][0]).toMatchObject({ material: "Clinker" });
  });
});
