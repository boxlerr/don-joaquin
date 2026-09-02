import { describe, it, expect } from "vitest";
import { clasificarFilas, type CargadoPrevio } from "./import-calendario";

/**
 * Las filas de septiembre de Joaquín Hnos tal como están cargadas hoy en la base
 * (relevadas el 02/09/2026). Son el caso que importa: Pablo ya las cargó a mano,
 * así que volver a subir el PDF de ese mes no puede duplicar nada.
 */
const JOAQUIN_HNOS_SEPTIEMBRE: CargadoPrevio[] = [
  { id: "1", nombre: "Ingresos Brutos - CM03", fecha_vencimiento: "2026-09-18", organismo: null },
  { id: "2", nombre: "IVA", fecha_vencimiento: "2026-09-24", organismo: null },
  { id: "3", nombre: "SICORE pago 2da. Q 072026", fecha_vencimiento: "2026-09-11", organismo: null },
];

/** Los mismos impuestos de junio, que sí tienen organismo cargado. */
const JUNIO_CON_ORGANISMO: CargadoPrevio[] = [
  { id: "9", nombre: "IVA", fecha_vencimiento: "2026-06-24", organismo: "AFIP" },
];

describe("clasificarFilas", () => {
  it("reimportar el mismo PDF no agenda nada dos veces", () => {
    const r = clasificarFilas(
      [
        { nombre: "Ingresos Brutos - CM03", fechaVencimiento: "2026-09-18" },
        { nombre: "IVA", fechaVencimiento: "2026-09-24" },
      ],
      JOAQUIN_HNOS_SEPTIEMBRE,
    );
    expect(r.map((f) => f.estado)).toEqual(["ya_cargado", "ya_cargado"]);
  });

  it("un calendario corregido MUEVE la fecha en vez de agendar otro vencimiento", () => {
    // El estudio manda de nuevo septiembre con el IVA dos días antes.
    const r = clasificarFilas([{ nombre: "IVA", fechaVencimiento: "2026-09-22" }], JOAQUIN_HNOS_SEPTIEMBRE);
    expect(r[0]!.estado).toBe("mueve_fecha");
    expect(r[0]!.existente?.id).toBe("2");
  });

  it("el mes que viene sí es un vencimiento nuevo, aunque el impuesto se llame igual", () => {
    const r = clasificarFilas([{ nombre: "IVA", fechaVencimiento: "2026-10-23" }], JOAQUIN_HNOS_SEPTIEMBRE);
    expect(r[0]!.estado).toBe("nuevo");
    expect(r[0]!.existente).toBeNull();
  });

  it("los tres renglones del PDF de Joaquín Nicolás son nuevos: son de otro contribuyente", () => {
    // El importador ya filtró por entidad, así que acá no llega nada de la
    // empresa. Es la prueba de que "IVA 18/09" de Nicolás NO pisa el de Hnos.
    const r = clasificarFilas(
      [
        { nombre: "Ingresos Brutos - CM03", fechaVencimiento: "2026-09-15" },
        { nombre: "IVA", fechaVencimiento: "2026-09-18" },
        { nombre: "Libro IVA Digital", fechaVencimiento: "2026-09-18" },
      ],
      [],
    );
    expect(r.map((f) => f.estado)).toEqual(["nuevo", "nuevo", "nuevo"]);
  });

  it("hereda el organismo del mismo impuesto cargado antes", () => {
    const r = clasificarFilas([{ nombre: "IVA", fechaVencimiento: "2026-10-23" }], JUNIO_CON_ORGANISMO);
    expect(r[0]!.organismo).toBe("AFIP");
  });

  it("sin nada cargado, todo se agenda", () => {
    const r = clasificarFilas([{ nombre: "IVA", fechaVencimiento: "2026-09-18" }], []);
    expect(r[0]!.estado).toBe("nuevo");
  });
});
