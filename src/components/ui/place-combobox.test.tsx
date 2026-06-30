import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { PlaceCombobox } from "./place-combobox";

const OPCIONES = [
  { id: "1", label: "ALLEN" },
  { id: "2", label: "TORTUGUITAS" },
  { id: "3", label: "L. NEGRA" },
];

function Harness({ onSelect }: { onSelect?: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form aria-label="form">
      <PlaceCombobox
        name="origen_nombre"
        value={v}
        onValueChange={setV}
        onSelect={onSelect}
        options={OPCIONES}
      />
    </form>
  );
}

function hiddenValue(): string {
  const el = document.querySelector(
    'input[name="origen_nombre"]',
  ) as HTMLInputElement | null;
  return el?.value ?? "";
}

describe("PlaceCombobox", () => {
  it("conserva el texto libre que no está en la lista (no lo borra)", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "NEUQUEN CAPITAL" } });

    // El texto tipeado se mantiene y viaja al form por el hidden input.
    expect(input.value).toBe("NEUQUEN CAPITAL");
    expect(hiddenValue()).toBe("NEUQUEN CAPITAL");
  });

  it("al elegir una opción del desplegable dispara onSelect y completa el valor", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox") as HTMLInputElement;

    // Abrir el desplegable (apertura por teclado, estándar de combobox) y filtrar.
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "ALL" } });

    const option = await screen.findByRole("option", { name: /ALLEN/i });
    fireEvent.click(option);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("ALLEN"));
    expect(hiddenValue()).toBe("ALLEN");
  });
});
