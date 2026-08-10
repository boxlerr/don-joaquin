import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DestinatarioMatriz from "./DestinatarioMatriz";

/**
 * La regla que se prueba acá no se ve mirando la pantalla: un casillero con
 * candado NO es "apagado", es "no se puede". La matriz es una preferencia y una
 * preferencia no puede otorgar un permiso — sin esto, un admin le tildaba
 * Préstamos a cualquiera y el mail salía con los montos del banco.
 */

const { setPref } = vi.hoisted(() => ({ setPref: vi.fn() }));
vi.mock("./actions", () => ({ setUsuarioAlertaPrefAction: setPref }));

const COLUMNAS = [
  { key: "vencimiento_docs", nombre: "Vencimiento de Documentos" },
  { key: "nuevo_viaje", nombre: "Nuevo Viaje" },
  { key: "prestamos_vencimiento", nombre: "Préstamos", bloqueadaPor: "Préstamos" },
  { key: "cheques_vencidos", nombre: "Cheques", bloqueadaPor: "Cheques" },
];

function dibujar(enabledInicial: string[] = ["vencimiento_docs"]) {
  return render(
    <DestinatarioMatriz
      usuarioId="00000000-0000-4000-8000-000000000001"
      nombre="Anabela Paterno"
      email="seguridad@transportedonjoaquin.com.ar"
      rol="Usuario Administrativo"
      columnas={COLUMNAS}
      enabledInicial={enabledInicial}
    />,
  );
}

beforeEach(() => {
  setPref.mockReset();
  setPref.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe("DestinatarioMatriz", () => {
  it("una columna bloqueada no es un botón: no se puede tildar", async () => {
    dibujar();
    // Las públicas sí son botones.
    expect(screen.getByRole("button", { name: /Nuevo Viaje/ })).toBeTruthy();
    // Las bloqueadas no aparecen como control en absoluto.
    expect(screen.queryByRole("button", { name: /Préstamos/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Cheques/ })).toBeNull();
  });

  it("el candado dice POR QUÉ y a dónde ir a resolverlo", () => {
    dibujar();
    const chip = screen.getByLabelText(/Préstamos — Sin acceso a Préstamos/);
    expect(chip.getAttribute("title")).toContain("Usuarios y permisos");
  });

  it("el contador no cuenta lo que no se va a entregar", () => {
    // Tildada de antes pero sin la sección: el mail no sale, así que no suma.
    dibujar(["vencimiento_docs", "prestamos_vencimiento", "cheques_vencidos"]);
    expect(screen.getByText("1 aviso")).toBeTruthy();
  });

  it("tildar una pública guarda", async () => {
    dibujar([]);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo Viaje/ }));
    await waitFor(() =>
      expect(setPref).toHaveBeenCalledWith(
        expect.objectContaining({ alertaKey: "nuevo_viaje", activo: true }),
      ),
    );
    expect(screen.getByText("1 aviso")).toBeTruthy();
  });

  it("si el servidor rechaza, revierte Y LO DICE", async () => {
    // Antes se revertía en silencio: un rechazo se veía igual que un clic que no
    // registró, y el admin volvía a hacerlo pensando que había fallado el mouse.
    setPref.mockResolvedValue({ error: "Sin acceso a Impuestos: primero hay que otorgarle la sección." });
    dibujar([]);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo Viaje/ }));

    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toContain("Sin acceso a Impuestos");
    expect(screen.getByText("Sin avisos")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nuevo Viaje/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
