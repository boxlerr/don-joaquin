import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMiniaturas } from "./TallerClient";

/**
 * El titileo de las fotos al escribir (27/08/2026).
 *
 * En el teléfono, cada letra que se escribía en "qué se hizo" hacía parpadear
 * las fotos recién sacadas: la miniatura salía de `URL.createObjectURL(f)`
 * escrito dentro del render, así que cada render fabricaba una dirección nueva
 * y el navegador tiraba la imagen y la volvía a leer. Y ninguna se liberaba:
 * dos fotos de cámara y un mensaje largo dejaban cientos de megas colgados.
 *
 * Lo que se prueba acá es lo que hace que el bug no vuelva: mientras la tanda
 * de fotos sea la misma, la dirección de cada miniatura tiene que ser la misma
 * por más veces que se dibuje la pantalla.
 */

const foto = (nombre: string) => new File(["x"], nombre, { type: "image/jpeg" });

let n = 0;

beforeEach(() => {
  n = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => `blob:foto-${++n}`),
    revokeObjectURL: vi.fn(),
  });
});

describe("las miniaturas de las fotos por subir", () => {
  it("no se rehacen al volver a dibujar la pantalla (escribir una letra)", () => {
    const fotos = [foto("antes.jpg"), foto("despues.jpg")];
    const { result, rerender } = renderHook(({ f }) => useMiniaturas(f), {
      initialProps: { f: fotos },
    });

    const primeras = result.current;
    expect(primeras).toHaveLength(2);

    // Diez teclas: en la versión con el bug, acá había veinte direcciones nuevas.
    for (let i = 0; i < 10; i++) rerender({ f: fotos });

    expect(result.current).toEqual(primeras);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("libera las direcciones viejas cuando cambia la tanda", () => {
    const primera = [foto("antes.jpg")];
    const { result, rerender } = renderHook(({ f }) => useMiniaturas(f), {
      initialProps: { f: primera },
    });
    const vieja = result.current[0];

    rerender({ f: [foto("antes.jpg"), foto("despues.jpg")] });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(vieja);
    expect(result.current).toHaveLength(2);
  });

  it("no deja nada colgado al cerrar la pantalla", () => {
    const { result, unmount } = renderHook(() => useMiniaturas([foto("a.jpg"), foto("b.jpg")]));
    const urls = result.current;
    unmount();
    for (const u of urls) expect(URL.revokeObjectURL).toHaveBeenCalledWith(u);
  });
});
