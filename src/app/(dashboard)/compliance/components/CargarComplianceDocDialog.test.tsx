import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import CargarComplianceDocDialog, { type EditVencimiento } from "./CargarComplianceDocDialog";
import type { ComplianceRequisito } from "../types";

/**
 * Renovar un vencimiento tiene que dejar archivar el documento.
 *
 * Editar la fecha era el ÚNICO camino del sistema que no aceptaba adjuntos: el
 * bloque de archivos estaba envuelto en `{!esEdicion && (...)}` y el diálogo lo
 * anunciaba, "actualizá la fecha sin volver a subir el archivo". Por ahí pasaron
 * las 45 renovaciones que cargó Ana el 08/08/2026, y las 45 quedaron como fecha
 * suelta, sin el papel detrás. En producción hay 848 filas de compliance y UNA
 * con archivo adjunto.
 *
 * Es un bloque condicional de una línea: se vuelve a apagar sin querer con
 * mucha facilidad, y desde la pantalla no se nota hasta que alguien pide el PDF.
 */

const { setComplianceVencimientoAction, uploadComplianceDocAction } = vi.hoisted(() => ({
  setComplianceVencimientoAction: vi.fn(async () => ({ success: true as const })),
  uploadComplianceDocAction: vi.fn(async () => ({ success: true as const })),
}));

vi.mock("../actions", () => ({
  setComplianceVencimientoAction,
  uploadComplianceDocAction,
  crearUrlSubidaComplianceDocAction: vi.fn(),
  setComplianceEnviarAAction: vi.fn(),
  // Al renovar, la ventana lista los papeles que ya tiene el documento.
  getComplianceDocArchivosAction: vi.fn(async () => []),
}));

const REQUISITO = {
  id: "req-1",
  codigo: "VTV",
  nombre: "VTV",
  cliente_aplica: "AMBOS",
  nivel: "unidad",
  periodicidad: "anual",
  dias_alerta: 30,
  tipo_documento_id: null,
  activo: true,
  orden: 1,
  enviar_a: null,
} as unknown as ComplianceRequisito;

const EDIT: EditVencimiento = {
  documento_id: "doc-1",
  fuente: "camion_documentos",
  fecha_vencimiento: "2026-05-28",
  observaciones: null,
};

const props = {
  requisito: REQUISITO,
  open: true,
  onOpenChange: () => {},
  onSuccess: () => {},
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("CargarComplianceDocDialog", () => {
  it("al EDITAR un vencimiento deja adjuntar el documento renovado", () => {
    render(<CargarComplianceDocDialog {...props} edit={EDIT} />);

    // El input de archivos tiene que estar presente, no solo el rótulo.
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    // El texto de la caja de archivos, que es único (el título del diálogo
    // también nombra el papel renovado).
    expect(screen.getByText(/se agrega a los que ya estaban/i)).toBeTruthy();
  });

  it("al editar ya no promete que NO se puede subir el archivo", () => {
    render(<CargarComplianceDocDialog {...props} edit={EDIT} />);
    expect(screen.queryByText(/sin volver a subir el archivo/i)).toBeNull();
  });

  it("sigue dejando adjuntar en el alta, que es lo que ya funcionaba", () => {
    render(<CargarComplianceDocDialog {...props} />);
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
    expect(screen.getByText(/podés registrar solo el vencimiento/i)).toBeTruthy();
  });

  it("dice DE QUIÉN es el documento", () => {
    // Se abre desde listas de 78 nombres y desde el botón "Agregar documento":
    // sin el nombre a la vista, cargar en el legajo equivocado no se nota.
    render(<CargarComplianceDocDialog {...props} camion_id="u1" entidadLabel="AE997MM" />);
    expect(screen.getByText("AE997MM")).toBeTruthy();
  });

  it("precarga la fecha que ya tenía el documento al editar", () => {
    render(<CargarComplianceDocDialog {...props} edit={EDIT} />);
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(fecha?.value).toBe("2026-05-28");
  });
});
