import { describe, it, expect } from "vitest";
import { armarGrupo, type ItemOrden } from "./resumen-diario";
import { ocultasDeUsuario } from "./resumen-diario";

/**
 * Lo que cada persona eligió NO ver en el pop-up.
 *
 * Guarda lo APAGADO: una categoría nueva le aparece a todos sin que nadie la
 * tenga que ir a tildar. Y ante cualquier duda —JSON roto, otra forma, un valor
 * que no es lista— devuelve vacío: esconder un vencimiento sin que nadie lo haya
 * pedido es peor que mostrar de más.
 */
describe("ocultasDeUsuario", () => {
  const NICO = "8f53af61-cfd6-402e-975e-0370544ac816";

  it("devuelve lo que apagó esa persona y nada de las demás", () => {
    const valor = JSON.stringify({ [NICO]: ["vencimiento_docs"], otro: ["cheques_vencidos"] });
    expect(ocultasDeUsuario(valor, NICO)).toEqual(["vencimiento_docs"]);
  });

  it("quien nunca eligió nada ve todo", () => {
    expect(ocultasDeUsuario(JSON.stringify({ otro: ["cheques_vencidos"] }), NICO)).toEqual([]);
    expect(ocultasDeUsuario(null, NICO)).toEqual([]);
    expect(ocultasDeUsuario("", NICO)).toEqual([]);
  });

  it("un valor roto no apaga nada", () => {
    expect(ocultasDeUsuario("{no es json", NICO)).toEqual([]);
    expect(ocultasDeUsuario("[]", NICO)).toEqual([]);
    expect(ocultasDeUsuario(JSON.stringify({ [NICO]: "vencimiento_docs" }), NICO)).toEqual([]);
    expect(ocultasDeUsuario(JSON.stringify({ [NICO]: [1, "impuestos"] }), NICO)).toEqual([
      "impuestos",
    ]);
  });
});

/**
 * Cuáles de todos los avisos de una categoría entran en la tarjeta del pop-up.
 *
 * El corte son cinco y se hace ACÁ, en el server: la pantalla dibuja lo que le
 * llega. Por eso el orden de esta función es el que decide si un aviso existe
 * para quien abre el sistema a la mañana.
 */
describe("armarGrupo", () => {
  const cheque = (titulo: string, dias: number, severidad: "critica" | "advertencia" | "info" = "critica"): ItemOrden => ({
    id: `ch-${titulo}-${dias}`,
    titulo,
    diasRestantes: dias,
    fecha: null,
    entidadId: null,
    href: "/cheques",
    severidad,
    noVence: false,
  });

  it("lo que vence HOY entra, y de lo vencido encabeza lo más reciente", () => {
    // El caso real del 02/09/2026, que ya había pasado el 27/08: seis cheques
    // nuestros sin debitar —uno de hace 49 días— llenaban los cinco lugares y el
    // echeq de Loma Negra que había que depositar ESE día no aparecía en ningún
    // lado. Nico: *"hoy vence un echeq que tenemos que depositar y no me salió
    // la alerta"*.
    const grupo = armarGrupo("cheques_vencidos", [
      cheque("$3.000.000", -49),
      cheque("HERNANDO", -9),
      cheque("ALERTA", -5),
      cheque("ARENAS 1", -2),
      cheque("ARENAS 2", -2),
      cheque("ARENAS 3", -2),
      cheque("Loma Negra", 0),
      cheque("COOPELECTRIC", 8),
    ]);

    expect(grupo.items).toHaveLength(5);
    // Primero lo de hoy; detrás, lo vencido de más reciente a más viejo (el de
    // $3.000.000 lleva 49 días ahí y se va al pie), y lo que todavía no venció
    // espera su turno.
    expect(grupo.items.map((i) => i.titulo)).toEqual([
      "Loma Negra",
      "ARENAS 1",
      "ARENAS 2",
      "ARENAS 3",
      "ALERTA",
    ]);
    // Y el pie habla de lo mismo que el número grande: de los 6 vencidos se ven 4.
    expect(grupo.vencidos).toBe(6);
    expect(grupo.restantesVencidos).toBe(2);
    expect(grupo.restantes).toBe(3);
  });

  it("la severidad desempata, no ordena: lo de hoy va primero igual", () => {
    // La cuota de un préstamo que vence hoy es "info" y un documento vencido es
    // "crítica": con la severidad arriba de todo, lo de hoy entraba último.
    const grupo = armarGrupo("prestamos", [
      cheque("Vencido hace una semana", -7, "critica"),
      cheque("Cuota de esta semana", 0, "info"),
      cheque("Cuota por vencer", 0, "advertencia"),
    ]);
    expect(grupo.items.map((i) => i.titulo)).toEqual([
      "Cuota por vencer",
      "Cuota de esta semana",
      "Vencido hace una semana",
    ]);
  });

  it("un cumpleaños de hoy no cuenta como vencido", () => {
    const cumple: ItemOrden = { ...cheque("Cumple — Pablo", 0), noVence: true };
    const grupo = armarGrupo("rrhh_eventos", [cumple, { ...cheque("Cumple — Ana", 4), noVence: true }]);
    expect(grupo.vencidos).toBe(0);
    expect(grupo.items[0].titulo).toBe("Cumple — Pablo");
  });
});
