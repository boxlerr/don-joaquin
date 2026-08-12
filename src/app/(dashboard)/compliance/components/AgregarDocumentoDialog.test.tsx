import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import AgregarDocumentoDialog from "./AgregarDocumentoDialog";
import type { ComplianceEstadoRow, ComplianceRequisito } from "../types";

/**
 * "Agregar documento" tiene que TERMINAR en la pantalla de carga.
 *
 * El paso 1 elige el documento y de quién es; el papel se sube en el paso 2. Ese
 * segundo diálogo se renderiza adentro de este componente, y el componente lo
 * monta el padre con `{agregando && <AgregarDocumentoDialog/>}`: cuando
 * "Continuar" avisaba `onOpenChange(false)`, el padre desmontaba todo el árbol y
 * se llevaba puesta la pantalla de carga que se acababa de pedir. Desde afuera se
 * veía como que el botón no hacía nada y no había forma de adjuntar el PDF.
 *
 * El harness replica ese montaje condicional a propósito: sin él, el test pasa
 * aunque el bug esté.
 */

const REQUISITO = {
  id: "req-epap",
  codigo: "EPAP",
  nombre: "EPAP",
  cliente_aplica: "YPF",
  nivel: "chofer",
  periodicidad: "anual",
  dias_alerta: 30,
  tipo_documento_id: null,
  activo: true,
  orden: 1,
  enviar_a: null,
} as unknown as ComplianceRequisito;

const ROW = {
  requisito_id: "req-epap",
  requisito_codigo: "EPAP",
  requisito_nombre: "EPAP",
  cliente_aplica: "YPF",
  nivel: "chofer",
  dias_alerta: 30,
  periodicidad: "anual",
  chofer_id: "ch-1",
  chofer_nombre: "Rossi Adrian Emilio",
  camion_id: null,
  camion_patente: null,
  documento_id: null,
  documento_fuente: null,
  fecha_vencimiento: null,
  archivo_id: null,
  estado: "faltante",
  dias_restantes: null,
} as unknown as ComplianceEstadoRow;

vi.mock("../actions", () => ({
  setComplianceVencimientoAction: vi.fn(),
  uploadComplianceDocAction: vi.fn(),
  crearUrlSubidaComplianceDocAction: vi.fn(),
  setComplianceEnviarAAction: vi.fn(),
}));

/** Igual que ComplianceUnifiedClient: el diálogo vive solo mientras `agregando`. */
function Harness() {
  const [agregando, setAgregando] = useState(true);
  if (!agregando) return null;
  return (
    <AgregarDocumentoDialog
      rows={[ROW]}
      requisitos={[REQUISITO]}
      open={agregando}
      onOpenChange={setAgregando}
      onSuccess={() => setAgregando(false)}
    />
  );
}

/** Abre un Combobox por su aria-label y elige la opción que diga `opcion`. */
async function elegir(etiqueta: RegExp, opcion: RegExp) {
  fireEvent.click(screen.getByRole("combobox", { name: etiqueta }));
  fireEvent.click(await screen.findByRole("option", { name: opcion }));
}

afterEach(() => cleanup());

describe("AgregarDocumentoDialog", () => {
  it("al continuar abre la pantalla de carga, con la caja para subir el papel", async () => {
    render(<Harness />);

    await elegir(/tipo de documento/i, /EPAP/i);
    await elegir(/chofer/i, /Rossi/i);

    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // El paso 2, con su input de archivos: es lo único que permite adjuntar.
    expect(await screen.findByRole("button", { name: /^cargar$/i })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('input[type="file"]')).not.toBeNull());
    // Y contra qué chofer se está cargando, para no errarle al legajo.
    expect(screen.getByText("Rossi Adrian Emilio")).toBeTruthy();
  });

  it("no ofrece continuar hasta que hay documento y persona elegidos", async () => {
    render(<Harness />);

    const continuar = screen.getByRole("button", { name: /continuar/i });
    expect((continuar as HTMLButtonElement).disabled).toBe(true);

    await elegir(/tipo de documento/i, /EPAP/i);
    // Con el tipo elegido pero sin chofer sigue sin haber a quién cargarle.
    expect((screen.getByRole("button", { name: /continuar/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
