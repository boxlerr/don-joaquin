import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { useBorrador } from "./useBorrador";
import { claveBorrador, objetoCon, guardarBorrador } from "@/lib/borrador-local";
import { UsuarioActualProvider } from "@/components/layout/UsuarioActualProvider";

type Form = { nombre: string; monto: string };
const VACIO: Form = { nombre: "", monto: "" };
const PANTALLA = "test-form";

/** Un formulario de juguete con el hook enchufado como se va a usar de verdad. */
function Formulario({ activo = true }: { activo?: boolean }) {
  const [form, setForm] = useState<Form>(VACIO);
  const { pendiente, guardadoTs, recuperar, descartar, limpiar } = useBorrador({
    pantalla: PANTALLA,
    valor: form,
    normalizar: objetoCon(VACIO),
    hayDatos: (f) => f.nombre.trim() !== "" || f.monto.trim() !== "",
    activo,
  });

  return (
    <div>
      <input
        aria-label="nombre"
        value={form.nombre}
        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
      />
      <span data-testid="guardado">{guardadoTs ? "guardado" : "sin guardar"}</span>
      {pendiente && (
        <div>
          <span data-testid="aviso">hay borrador: {pendiente.valor.nombre}</span>
          <button
            type="button"
            onClick={() => {
              const v = recuperar();
              if (v) setForm(v);
            }}
          >
            Recuperar
          </button>
          <button type="button" onClick={descartar}>
            Descartar
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setForm(VACIO);
          limpiar();
        }}
      >
        Guardar en el server
      </button>
    </div>
  );
}

const renderForm = (props?: { activo?: boolean }) =>
  render(
    <UsuarioActualProvider userId="u1">
      <Formulario {...props} />
    </UsuarioActualProvider>,
  );

const clave = () => claveBorrador(PANTALLA, "u1");

/** Corre el debounce del autoguardado. */
const pasarDebounce = async () => {
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
};

describe("useBorrador", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("guarda lo que se tipea después del debounce", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pérez" } });
    expect(localStorage.getItem(clave())).toBeNull();

    await pasarDebounce();

    expect(JSON.parse(localStorage.getItem(clave())!).valor.nombre).toBe("Pérez");
    expect(screen.getByTestId("guardado")).toHaveTextContent("guardado");
  });

  it("al volver ofrece el borrador, pero no lo restaura solo", async () => {
    guardarBorrador(clave(), { nombre: "Pérez", monto: "1000" });
    renderForm();

    await waitFor(() => expect(screen.getByTestId("aviso")).toBeInTheDocument());
    // El formulario sigue en blanco: se ofrece, no se impone.
    expect(screen.getByLabelText("nombre")).toHaveValue("");
  });

  it("mientras el borrador está sin decidir, el formulario vacío NO lo pisa", async () => {
    guardarBorrador(clave(), { nombre: "Pérez", monto: "1000" });
    renderForm();

    await waitFor(() => expect(screen.getByTestId("aviso")).toBeInTheDocument());
    await pasarDebounce();

    expect(JSON.parse(localStorage.getItem(clave())!).valor.nombre).toBe("Pérez");
  });

  it("recuperar devuelve el valor y saca el aviso", async () => {
    guardarBorrador(clave(), { nombre: "Pérez", monto: "1000" });
    renderForm();

    await waitFor(() => expect(screen.getByTestId("aviso")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Recuperar"));

    expect(screen.getByLabelText("nombre")).toHaveValue("Pérez");
    expect(screen.queryByTestId("aviso")).not.toBeInTheDocument();
  });

  it("descartar borra el borrador del navegador", async () => {
    guardarBorrador(clave(), { nombre: "Pérez", monto: "1000" });
    renderForm();

    await waitFor(() => expect(screen.getByTestId("aviso")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Descartar"));

    expect(localStorage.getItem(clave())).toBeNull();
    expect(screen.queryByTestId("aviso")).not.toBeInTheDocument();
  });

  it("vaciar el formulario borra el borrador: no hay nada que salvar", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pérez" } });
    await pasarDebounce();
    expect(localStorage.getItem(clave())).not.toBeNull();

    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "" } });
    await pasarDebounce();
    expect(localStorage.getItem(clave())).toBeNull();
  });

  it("después de guardar en el server el borrador se va, y el debounce en vuelo no lo revive", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pérez" } });
    await pasarDebounce();
    expect(localStorage.getItem(clave())).not.toBeNull();

    // Se tipea de nuevo (queda un debounce en vuelo) y se guarda antes de que cierre.
    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pérez Juan" } });
    fireEvent.click(screen.getByText("Guardar en el server"));
    await pasarDebounce();

    expect(localStorage.getItem(clave())).toBeNull();
  });

  it("con el diálogo cerrado no guarda ni ofrece nada", async () => {
    guardarBorrador(clave(), { nombre: "Pérez", monto: "1000" });
    renderForm({ activo: false });

    await pasarDebounce();
    expect(screen.queryByTestId("aviso")).not.toBeInTheDocument();
    // Y lo que había sigue intacto para cuando se abra.
    expect(JSON.parse(localStorage.getItem(clave())!).valor.nombre).toBe("Pérez");
  });

  it("cerrar la pestaña guarda sin esperar el debounce", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pérez" } });
    expect(localStorage.getItem(clave())).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(JSON.parse(localStorage.getItem(clave())!).valor.nombre).toBe("Pérez");
  });

  it("el borrador de otro usuario no se ofrece", async () => {
    guardarBorrador(claveBorrador(PANTALLA, "otro"), { nombre: "Ajeno", monto: "" });
    renderForm();

    await pasarDebounce();
    expect(screen.queryByTestId("aviso")).not.toBeInTheDocument();
  });
});
