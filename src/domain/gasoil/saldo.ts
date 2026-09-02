/**
 * Cuántos litros le quedan al chofer de la vuelta.
 *
 * Pedido de Nico (02/09/2026): que el chofer pueda anotar lo que va cargando y
 * ver cuánto le queda. La cuenta es una resta, pero lo que se cuida acá es lo
 * que pasa en los bordes, que es donde una resta deja de ser inocente:
 *
 *  * **Cargar de más no se esconde.** Si cargó 1.000 sobre 940 autorizados, el
 *    saldo no se planta en cero: dice que se pasó por 60. Un cero taparía
 *    exactamente el dato por el que después YPF reclama.
 *  * **Cero cargado y "todavía no cargó nada" son lo mismo acá**, y está bien:
 *    la vuelta nace con el saldo entero. Lo que no puede pasar es que una vuelta
 *    sin cargas se vea igual que una vuelta completada.
 */

/**
 * Lo único que la cuenta necesita de una carga.
 *
 * A propósito no pide `id` ni fecha: la pantalla del chofer y la de la oficina
 * traen la carga con formas distintas, y obligarlas a compartir una sola forma
 * sólo para sumar litros es acoplarlas sin motivo.
 */
export type CargaDeclarada = { litros: number };

export type Saldo = {
  /** Lo que le corresponde a la vuelta según el cuadro. */
  autorizados: number;
  /** Lo que dijo que cargó, sumando las previas. */
  cargados: number;
  /** Autorizados − cargados. **Negativo si se pasó**: no se corta en cero. */
  restantes: number;
  /** Cuánto del cupo lleva usado, 0–100+. `null` si la vuelta no autorizó nada. */
  usadoPct: number | null;
  /** Cargó más de lo autorizado. */
  excedido: boolean;
  /** No anotó ninguna carga todavía. */
  sinCargas: boolean;
};

/** Suma con dos decimales, para que la resta no arrastre ruido binario. */
const red2 = (n: number) => Math.round(n * 100) / 100;

export function calcularSaldo(autorizados: number, cargas: CargaDeclarada[]): Saldo {
  const cargados = red2(cargas.reduce((a, c) => a + (Number(c.litros) || 0), 0));
  const restantes = red2(autorizados - cargados);
  return {
    autorizados: red2(autorizados),
    cargados,
    restantes,
    usadoPct: autorizados > 0 ? (cargados / autorizados) * 100 : null,
    excedido: restantes < 0,
    sinCargas: cargas.length === 0,
  };
}

/**
 * Qué frase le corresponde al saldo, escrita para el chofer.
 *
 * Vive acá y no en la pantalla porque es la parte que se prueba: el texto que
 * lee alguien parado en el surtidor decide si carga de más o de menos.
 */
export function rotuloDeSaldo(s: Saldo): { titulo: string; detalle: string } {
  if (s.excedido) {
    return {
      titulo: "Te pasaste",
      detalle: `Cargaste ${fmt(s.cargados)} y te correspondían ${fmt(s.autorizados)}.`,
    };
  }
  if (s.restantes === 0) {
    return {
      titulo: "Ya cargaste todo",
      detalle: `Los ${fmt(s.autorizados)} litros de la vuelta.`,
    };
  }
  if (s.sinCargas) {
    return {
      titulo: "Podés cargar",
      detalle: "Todavía no anotaste ninguna carga de esta vuelta.",
    };
  }
  return {
    titulo: "Te quedan",
    detalle: `Ya cargaste ${fmt(s.cargados)} de ${fmt(s.autorizados)}.`,
  };
}

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * ¿Esta vuelta sigue "en curso" para el chofer?
 *
 * No hay un botón de cerrar vuelta y no lo va a haber: nadie va a acordarse de
 * apretarlo. Una vuelta está en curso el día que se anotó — que es como trabaja
 * la operación, una vuelta por día — y al día siguiente pasa a ser historial.
 */
export function estaEnCurso(fechaVuelta: string, hoy: string): boolean {
  return fechaVuelta === hoy;
}
