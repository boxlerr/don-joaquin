import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdjuntosEditable from "./AdjuntosEditable";

vi.mock("./AdjuntosInline", () => ({ default: () => null }));

const actions = {
  getArchivos: vi.fn(async () => []),
  crearUrlSubida: vi.fn(async () => ({
    signedUrl: "https://x/y",
    bucket: "b",
    path: "p",
  })),
  vincularArchivos: vi.fn(async () => ({ ok: true })),
};

/**
 * "Sacar foto": el CV llega en mano y se sube fotografiándolo.
 *
 * Bárbara, 01/09/26: "muchas veces el CV lo quiero subir sacándole una foto
 * desde el celu y ya, bueno, me voy a poner a escanear todo, y ahí es donde se
 * me complica". Lo que sobraba era el paso del menú del sistema: sin `capture`
 * el teléfono pregunta primero si querés la galería, la cámara o un archivo.
 */
describe("AdjuntosEditable · sacar foto", () => {
  it("abre la cámara de atrás directo, sin pasar por el menú del teléfono", () => {
    const { container } = render(
      <AdjuntosEditable entidadId="e1" permitirFoto {...actions} />,
    );

    const camara = container.querySelector('input[capture]') as HTMLInputElement;
    expect(camara).not.toBeNull();
    expect(camara.getAttribute("capture")).toBe("environment");
    expect(camara.getAttribute("accept")).toBe("image/*");
  });

  it("deja intacto el input de siempre, para subir un archivo ya guardado", () => {
    const { container } = render(
      <AdjuntosEditable entidadId="e1" permitirFoto {...actions} />,
    );

    // El input general NO lleva `capture`: si lo llevara, el teléfono dejaría de
    // ofrecer "elegir archivo" y sólo abriría la cámara.
    const general = container.querySelector(
      'input[type="file"][multiple]',
    ) as HTMLInputElement;
    expect(general.hasAttribute("capture")).toBe(false);
    expect(general.hasAttribute("accept")).toBe(false);
  });

  it("el botón de la cámara dispara ese input y no el otro", () => {
    const { container } = render(
      <AdjuntosEditable entidadId="e1" permitirFoto {...actions} />,
    );
    const camara = container.querySelector("input[capture]") as HTMLInputElement;
    const general = container.querySelector(
      'input[type="file"][multiple]',
    ) as HTMLInputElement;
    const clickCamara = vi.spyOn(camara, "click");
    const clickGeneral = vi.spyOn(general, "click");

    fireEvent.click(screen.getByText("Sacar foto"));

    expect(clickCamara).toHaveBeenCalled();
    expect(clickGeneral).not.toHaveBeenCalled();
  });

  it("el botón se esconde en la compu: ahí la cámara es la webcam", () => {
    render(<AdjuntosEditable entidadId="e1" permitirFoto {...actions} />);

    // `sm:hidden` — a partir de 640px no se muestra. Fotografiar un papel con la
    // webcam de la notebook no sirve.
    expect(screen.getByText("Sacar foto").className).toMatch(/\bsm:hidden\b/);
  });

  it("sin `permitirFoto` no aparece nada de cámara", () => {
    const { container } = render(<AdjuntosEditable entidadId="e1" {...actions} />);

    expect(screen.queryByText("Sacar foto")).not.toBeInTheDocument();
    expect(container.querySelector("input[capture]")).toBeNull();
  });

  it("no ofrece sacar foto a quien no puede editar", () => {
    const { container } = render(
      <AdjuntosEditable entidadId="e1" permitirFoto canEdit={false} {...actions} />,
    );

    expect(screen.queryByText("Sacar foto")).not.toBeInTheDocument();
    expect(container.querySelector("input[capture]")).toBeNull();
  });
});
