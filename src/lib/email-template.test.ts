import { describe, it, expect } from "vitest";
import { renderEmail, sincronizarDias } from "./email-template";

/** Fecha ISO a `n` días de hoy (negativa = en el pasado). */
function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("sincronizarDias", () => {
  it("corrige el 'hace N días' congelado del mensaje", () => {
    // El caso real: la alerta se generó a los 35 días de vencido y el texto quedó
    // ahí, mientras el chip decía 69. El correo se contradecía a sí mismo.
    const msg = 'El documento "VTV" (AE228WV) que se presenta a Loma Negra y YPF está vencido hace 35 días.';
    expect(sincronizarDias(msg, enDias(-69))).toContain("hace 69 días");
    expect(sincronizarDias(msg, enDias(-69))).not.toContain("35");
  });

  it("corrige el 'en N días' de lo que todavía no venció", () => {
    const msg = "El documento \"VTV\" del camión AB123CD vence en 12 días.";
    expect(sincronizarDias(msg, enDias(3))).toContain("en 3 días");
  });

  it("respeta el singular", () => {
    expect(sincronizarDias("vence en 5 días.", enDias(1))).toContain("en 1 día.");
    expect(sincronizarDias("venció hace 9 días.", enDias(-1))).toContain("hace 1 día.");
  });

  it("no toca los textos que hablan de otra unidad", () => {
    const meses = "Hay 5 insumos del catálogo con el precio sin actualizar hace más de 3 meses.";
    expect(sincronizarDias(meses, enDias(20))).toBe(meses);

    const horas = "Viaje Nº 4821 lleva 52 horas sin cerrarse.";
    expect(sincronizarDias(horas, enDias(-4))).toBe(horas);

    const anios = "Admin Paula Quiroga cumple 7 años en la empresa el 15 de julio.";
    expect(sincronizarDias(anios, enDias(-21))).toBe(anios);
  });

  it("sin fecha no inventa nada", () => {
    const msg = "Algo pasó hace 4 días.";
    expect(sincronizarDias(msg, null)).toBe(msg);
  });

  it("es idempotente: aplicarlo dos veces da lo mismo", () => {
    const msg = "está vencido hace 35 días.";
    const una = sincronizarDias(msg, enDias(-69));
    expect(sincronizarDias(una, enDias(-69))).toBe(una);
  });

  describe("sentido: lo que ya pasó no puede seguir prometiendo futuro", () => {
    it("pasa a pretérito el 'vence en N días' de una alerta ya vencida", () => {
      // El bug: el número se corregía pero el tiempo verbal no, así que el aviso
      // afirmaba un vencimiento que no existe mientras el chip decía "Venció
      // hace 10 días · 26/07/2026".
      const msg = 'El documento "LIBRE DEUDA" presentado a ARCA vence en 30 días.';
      const out = sincronizarDias(msg, enDias(-10));
      expect(out).toBe('El documento "LIBRE DEUDA" presentado a ARCA venció hace 10 días.');
    });

    it("conjuga sin romper el resto de la oración (F931)", () => {
      const msg = "El Formulario 931 06/2026 vence en 10 días y falta enviarlo a YPF. Es bloqueante: sin 931 no puede cargar nadie.";
      expect(sincronizarDias(msg, enDias(-3))).toBe(
        "El Formulario 931 06/2026 venció hace 3 días y falta enviarlo a YPF. Es bloqueante: sin 931 no puede cargar nadie.",
      );
    });

    it("respeta la mayúscula del verbo que abre la oración (ausencias)", () => {
      const msg = "Bruno Diaz no estará disponible del 3 al 8 de agosto (licencia). Empieza en 3 días.";
      expect(sincronizarDias(msg, enDias(-2))).toContain("Empezó hace 2 días.");
    });

    it("vuelve al presente si la fecha todavía no llegó", () => {
      const msg = 'El impuesto "IIBB" (ARCA) venció hace 4 días y no figura presentado.';
      expect(sincronizarDias(msg, enDias(6))).toBe(
        'El impuesto "IIBB" (ARCA) vence en 6 días y no figura presentado.',
      );
    });

    it("respeta el singular al dar vuelta el sentido", () => {
      expect(sincronizarDias("vence en 5 días.", enDias(-1))).toBe("venció hace 1 día.");
      expect(sincronizarDias("venció hace 9 días.", enDias(1))).toBe("vence en 1 día.");
    });

    it("sigue siendo idempotente después de invertir el sentido", () => {
      const una = sincronizarDias("vence en 30 días.", enDias(-10));
      expect(sincronizarDias(una, enDias(-10))).toBe(una);
    });

    it("recorta la oración cuando el verbo no se puede conjugar, sin dejar frases rotas", () => {
      // La cuota de préstamo mete la cuenta entre paréntesis, sin verbo pegado:
      // no hay nada que conjugar, así que se va la oración entera y el cuándo lo
      // dice el chip. El importe (con sus puntos de miles) queda intacto.
      const msg = "Esta semana vence la cuota 44 de 48 de Galicia: $1.000.000 (TNA 45%). Vence el 12/07/2026 (en 7 días).";
      const out = sincronizarDias(msg, enDias(-4));
      expect(out).toBe("Esta semana vence la cuota 44 de 48 de Galicia: $1.000.000 (TNA 45%).");
    });
  });

  describe("período de prueba: 'le quedan N días'", () => {
    // La fila se crea UNA vez (misma clave de dedup en los hitos de 30/15/5), así
    // que el texto queda congelado en 30: a los 15 y a los 5 contradecía al chip.
    const msg = "Al chofer Marcos Rojas le quedan 30 días para finalizar su período de prueba (Vence el 3 de agosto).";

    it("corrige el número en el hito de 15", () => {
      const out = sincronizarDias(msg, enDias(15));
      expect(out).toContain("le quedan 15 días para finalizar");
      expect(out).not.toContain("30 días");
    });

    it("corrige el número en el hito de 5", () => {
      expect(sincronizarDias(msg, enDias(5))).toContain("le quedan 5 días");
    });

    it("respeta el singular", () => {
      expect(sincronizarDias(msg, enDias(1))).toContain("le quedan 1 día para finalizar");
    });

    it("no promete días que ya no quedan cuando la fecha pasó", () => {
      // "le quedan" no tiene vuelta en pretérito que sea cierta (no quedaban N
      // días: el período terminó hace N), así que se suelta la oración y el
      // título + el chip cuentan la historia. En producción casi no se ve: es
      // una efeméride y se resuelve sola al día siguiente.
      expect(sincronizarDias(msg, enDias(-3))).toBe("");
    });

    it("no toca los saldos, que cuentan días de otra cosa", () => {
      const saldo = "Marcos Rojas tiene 12 días de vacaciones de períodos anteriores que vencen el 31/12/2026.";
      expect(sincronizarDias(saldo, enDias(-5))).toBe(saldo);

      const quedan = "A Marcos Rojas le quedan 12 días de vacaciones del año pasado.";
      expect(sincronizarDias(quedan, enDias(20))).toBe(quedan);
    });
  });

  describe("'hoy' congelado", () => {
    // La ausencia se genera el día que arranca con el texto "Empieza hoy", y ese
    // "hoy" queda escrito para siempre: la del 13/07 seguía diciéndolo el 05/08,
    // al lado de un chip que decía "Venció hace 23 días".
    const ausencia =
      "Pablo Acosta no estará disponible del 13 al 26 de julio (vacaciones). Empieza hoy.";

    it("suelta la oración si el día ya pasó", () => {
      expect(sincronizarDias(ausencia, enDias(-23))).toBe(
        "Pablo Acosta no estará disponible del 13 al 26 de julio (vacaciones).",
      );
    });

    it("suelta la oración si el día todavía no llegó", () => {
      expect(sincronizarDias(ausencia, enDias(4))).not.toContain("hoy");
    });

    it("lo respeta cuando es verdad", () => {
      expect(sincronizarDias(ausencia, enDias(0))).toBe(ausencia);
    });

    it("también en la forma 'Hoy vence …', que lleva el verbo detrás", () => {
      const cuota = "Hoy vence la cuota 44/48 de Galicia: $1.000.000.";
      expect(sincronizarDias(cuota, enDias(-2))).toBe("");
      expect(sincronizarDias(cuota, enDias(0))).toBe(cuota);
    });

    it("no confunde 'hoy' adentro de otra palabra", () => {
      const msg = "El chofer Hoyos no estará disponible.";
      expect(sincronizarDias(msg, enDias(-5))).toBe(msg);
    });
  });

  it("no deja el párrafo vacío en el mail cuando el mensaje se recorta entero", () => {
    const html = renderEmail({
      baseUrl: "https://ejemplo.test",
      titulo: "Avisos",
      intro: "Uno",
      alertas: [
        {
          titulo: "Fin período de prueba — Marcos Rojas",
          mensaje: "Al chofer Marcos Rojas le quedan 30 días para finalizar su período de prueba.",
          severidad: "info",
          fecha_vencimiento: enDias(-3),
          categoria: "rrhh_eventos",
          href: "https://ejemplo.test/choferes",
        },
      ],
    });
    expect(html).not.toMatch(/line-height:1\.6;"><\/div>/);
    expect(html).toContain("Venció hace 3 días");
  });
});
