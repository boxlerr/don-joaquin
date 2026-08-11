import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OrganismoChecklistPage from "./OrganismoChecklistPage";
import type { ComplianceDestinatario, OrganismoChecklistRow } from "../types";

/**
 * SICOP y Secondi eran pantallas de solo lectura sobre una tabla que no se podía
 * llenar desde ningún lado: el estado vacío decía "agregá requisitos desde la
 * base de datos". De los 21 requisitos cargados en producción, CERO eran de
 * organismo — justamente por eso.
 *
 * Lo que se prueba acá es que la pantalla ahora se pueda usar: que el vacío sea
 * el punto de partida y no una pared, y que quien no tiene permiso de escritura
 * no vea acciones que no puede ejecutar.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ eliminarRequisitoOrganismoAction: vi.fn() }));
vi.mock("../actions", () => ({ getSignedUrlComplianceArchivoAction: vi.fn() }));
vi.mock("./export", () => ({ exportarOrganismoXlsx: vi.fn() }));

const SICOP: ComplianceDestinatario = {
  id: "org-1",
  codigo: "SICOP",
  nombre: "SICOP",
  descripcion: "Organismo de control",
  orden: 1,
  activo: true,
} as ComplianceDestinatario;

const ROW: OrganismoChecklistRow = {
  requisito_id: "req-1",
  requisito_codigo: "HABILITACION",
  requisito_nombre: "Habilitación de tránsito",
  requisito_descripcion: null,
  nivel: "empresa",
  periodicidad: "anual",
  dias_alerta: 30,
  enviar_a: "portal SICOP",
  documento_id: null,
  fecha_emision: null,
  fecha_vencimiento: null,
  archivo_id: null,
  observaciones: null,
  presentado_por_nombre: null,
  created_at: null,
  estado: "faltante",
  dias_restantes: null,
} as OrganismoChecklistRow;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("OrganismoChecklistPage", () => {
  it("sin requisitos, el vacío ofrece cargar el primero en vez de mandar a la base de datos", () => {
    render(<OrganismoChecklistPage destinatario={SICOP} rows={[]} canWrite />);

    expect(screen.getByText(/Todavía no cargaste qué se presenta ante SICOP/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cargar el primero/i })).toBeTruthy();
    // El texto viejo mandaba a la base de datos, que no es algo que el usuario pueda hacer.
    expect(screen.queryByText(/desde la base de datos/i)).toBeNull();
  });

  it("quien solo puede leer no ve acciones que no puede ejecutar", () => {
    render(<OrganismoChecklistPage destinatario={SICOP} rows={[]} canWrite={false} />);

    expect(screen.queryByRole("button", { name: /Cargar el primero/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Nuevo requisito/i })).toBeNull();
  });

  it("con requisitos ofrece crearlos, exportar y editar o dar de baja cada uno", () => {
    render(<OrganismoChecklistPage destinatario={SICOP} rows={[ROW]} canWrite />);

    expect(screen.getByRole("button", { name: /Nuevo requisito/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Exportar/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Editar el requisito Habilitación de tránsito/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Dar de baja el requisito Habilitación de tránsito/i }),
    ).toBeTruthy();
  });

  it("no ofrece exportar una lista vacía", () => {
    render(<OrganismoChecklistPage destinatario={SICOP} rows={[]} canWrite />);
    expect(screen.queryByRole("button", { name: /Exportar/i })).toBeNull();
  });
});
