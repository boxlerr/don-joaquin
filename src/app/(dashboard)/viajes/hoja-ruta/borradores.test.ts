import { describe, it, expect } from "vitest";
import { aCambio, borradorDe, borradorSucio, type Borrador } from "./borradores";
import type { HrViajeItem } from "./actions";

/** Un viaje como llega de la base: con importe, remito y tonelaje cargados. */
const VIAJE: HrViajeItem = {
  id: "v1",
  codigo: "2026-0001",
  fecha_viaje: "2026-07-27",
  origen: "LOMASER",
  destino: "RAMALLO",
  km_con_carga: 300,
  km_vacios: 0,
  tonelaje_real: 28.5,
  nro_remito: "A-1234",
  nro_viaje_ypf: null,
  material: null,
  monto_flete: 450000,
  cliente: "LOMA NEGRA S.A",
  estado: "cerrado",
  facturado: true,
  es_vacio: false,
  observaciones: null,
};

const sinTocar = (): Borrador => borradorDe(VIAJE);

describe("borradorDe", () => {
  it("refleja el viaje tal cual está", () => {
    expect(borradorDe(VIAJE)).toEqual({
      origen: "LOMASER",
      destino: "RAMALLO",
      km: "300",
      kmVacios: "0",
      toneladas: "28.5",
      remito: "A-1234",
      monto: "450000",
    });
  });

  it("los nulos quedan como vacío, no como '0' ni 'null'", () => {
    const b = borradorDe({ ...VIAJE, tonelaje_real: null, monto_flete: null, nro_remito: null });
    expect(b.toneladas).toBe("");
    expect(b.monto).toBe("");
    expect(b.remito).toBe("");
  });
});

describe("borradorSucio", () => {
  it("sin tocar nada no está sucio", () => {
    expect(borradorSucio(VIAJE, sinTocar())).toBe(false);
  });

  it("los espacios de más no cuentan como cambio", () => {
    expect(borradorSucio(VIAJE, { ...sinTocar(), destino: "  RAMALLO  " })).toBe(false);
  });

  it("detecta el cambio en cualquiera de los siete campos", () => {
    const campos: (keyof Borrador)[] = [
      "origen", "destino", "km", "kmVacios", "toneladas", "remito", "monto",
    ];
    for (const c of campos) {
      expect(borradorSucio(VIAJE, { ...sinTocar(), [c]: "otra cosa" })).toBe(true);
    }
  });
});

describe("aCambio — sólo manda lo que cambió", () => {
  it("EL BUG: corregir el origen NO puede tocar el importe ni el tonelaje", () => {
    // Éste es el caso caro: si en el medio alguien cargó el DM de YPF, mandar
    // el importe del snapshot viejo lo borraba y apagaba facturado/cobrado.
    const c = aCambio(VIAJE, { ...sinTocar(), origen: "L. NEGRA" });
    expect(c).toEqual({ id: "v1", origen_nombre: "L. NEGRA" });
    expect("monto_flete" in c).toBe(false);
    expect("tonelaje_real" in c).toBe(false);
    expect("nro_remito" in c).toBe(false);
    expect("km_con_carga" in c).toBe(false);
  });

  it("sin cambios manda sólo el id", () => {
    expect(aCambio(VIAJE, sinTocar())).toEqual({ id: "v1" });
  });

  it("manda varios campos cuando se tocaron varios", () => {
    const c = aCambio(VIAJE, { ...sinTocar(), destino: "CERRITO", km: "900" });
    expect(c).toEqual({ id: "v1", destino_nombre: "CERRITO", km_con_carga: 900 });
  });

  it("vaciar el importe sí lo manda en null: es un borrado a propósito", () => {
    const c = aCambio(VIAJE, { ...sinTocar(), monto: "" });
    expect(c).toEqual({ id: "v1", monto_flete: null });
  });

  it("vaciar km manda 0, porque en la base es NOT NULL", () => {
    // Con null el UPDATE fallaba y se caía el guardado del lote entero.
    expect(aCambio(VIAJE, { ...sinTocar(), km: "" })).toEqual({ id: "v1", km_con_carga: 0 });
    expect(aCambio(VIAJE, { ...sinTocar(), kmVacios: "" })).toEqual({ id: "v1", km_vacios: 0 });
  });

  it("el tonelaje sí acepta null: en la base es nullable", () => {
    const c = aCambio({ ...VIAJE, tonelaje_real: 30 }, { ...borradorDe({ ...VIAJE, tonelaje_real: 30 }), toneladas: "" });
    expect(c).toEqual({ id: "v1", tonelaje_real: null });
  });

  it("vaciar un texto lo manda en null, no en cadena vacía", () => {
    expect(aCambio(VIAJE, { ...sinTocar(), destino: "   " })).toEqual({
      id: "v1",
      destino_nombre: null,
    });
  });

  it("un número mal tipeado no se manda como NaN", () => {
    const c = aCambio(VIAJE, { ...sinTocar(), monto: "abc" });
    expect(c.monto_flete).toBeNull();
  });

  it("los espacios de más no generan un cambio fantasma", () => {
    expect(aCambio(VIAJE, { ...sinTocar(), origen: " LOMASER " })).toEqual({ id: "v1" });
  });
});
