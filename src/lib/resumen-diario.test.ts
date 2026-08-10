import { describe, it, expect } from "vitest";
import { serieAtraso } from "./resumen-diario";

/**
 * La serie del mini gráfico de cada tarjeta del resumen del día.
 *
 * Lo que se cuida acá es que el gráfico no contradiga al número que tiene al
 * lado: el último punto tiene que ser EXACTAMENTE la cuenta de vencidos que
 * dibuja la tarjeta. Si alguien cambia el predicado de un lado y no del otro, la
 * curva termina en un valor y el número grande dice otro.
 */

/** Los vencidos como los cuenta el pop-up, para comparar contra la serie. */
function vencidosDe(items: { diasRestantes: number | null; efemeride: boolean }[]): number {
  return items.filter((i) => !i.efemeride && i.diasRestantes !== null && i.diasRestantes < 0).length;
}

const aviso = (diasRestantes: number | null, efemeride = false) => ({ diasRestantes, efemeride });

describe("serieAtraso", () => {
  it("termina en la misma cuenta de vencidos que muestra la tarjeta", () => {
    const items = [aviso(-147), aviso(-30), aviso(-1), aviso(5), aviso(null)];

    const serie = serieAtraso(items)!;

    expect(serie).toHaveLength(12);
    expect(serie[11]).toBe(vencidosDe(items));
    expect(serie[11]).toBe(3);
  });

  it("nunca baja: está armada sobre lo que sigue abierto", () => {
    const serie = serieAtraso([aviso(-100), aviso(-40), aviso(-9), aviso(-2)])!;

    for (let i = 1; i < serie.length; i++) {
      expect(serie[i]!).toBeGreaterThanOrEqual(serie[i - 1]!);
    }
  });

  it("ubica cada aviso en la semana en la que se venció", () => {
    // Vencido hace 21 días = tres semanas: entra recién en el cuarto punto
    // contando desde la derecha (índices 11, 10, 9 → 8).
    const serie = serieAtraso([aviso(-21)])!;

    expect(serie[11]).toBe(1); // hoy
    expect(serie[9]).toBe(1); // hace 2 semanas ya estaba vencido
    expect(serie[8]).toBe(0); // hace 3 semanas todavía no
  });

  it("no cuenta cumpleaños ni avisos sin fecha", () => {
    // Un cumpleaños de ayer no existe (lo filtra antes el pop-up), pero uno con
    // días negativos por cualquier motivo no puede sumar como atraso.
    expect(serieAtraso([aviso(-10, true), aviso(null)])).toBeNull();
  });

  it("devuelve null cuando hoy no hay nada vencido", () => {
    // Es la señal para no dibujar: una línea en cero no cuenta nada.
    expect(serieAtraso([aviso(3), aviso(20)])).toBeNull();
    expect(serieAtraso([])).toBeNull();
  });

  it("marca como piso lo que ya venía de antes de las 12 semanas", () => {
    // 147 días es mucho más que 12 semanas: el aviso entra desde el primer punto
    // y eso es justamente lo que hay que poder leer en la curva.
    const serie = serieAtraso([aviso(-147), aviso(-3)])!;

    expect(serie[0]).toBe(1);
    expect(serie[11]).toBe(2);
  });
});
