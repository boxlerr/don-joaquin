import type { HrViajeItem, CambioViajeHr } from "./actions";

/**
 * Los borradores de la hoja de ruta: lo que se está tipeando en cada fila
 * mientras se corrige el mes.
 *
 * Vive aparte del componente porque acá está la regla que evita el error más
 * caro de esta pantalla —mandar de vuelta un dato que el usuario no tocó— y esa
 * regla merece estar probada.
 */

/** Lo que se está tipeando en una fila. Todo string: sale de inputs. */
export type Borrador = {
  origen: string;
  destino: string;
  km: string;
  kmVacios: string;
  toneladas: string;
  remito: string;
  monto: string;
};

export function borradorDe(v: HrViajeItem): Borrador {
  return {
    origen: v.origen ?? "",
    destino: v.destino ?? "",
    km: v.km_con_carga == null ? "" : String(v.km_con_carga),
    kmVacios: v.km_vacios == null ? "" : String(v.km_vacios),
    toneladas: v.tonelaje_real == null ? "" : String(v.tonelaje_real),
    remito: v.nro_remito ?? "",
    monto: v.monto_flete == null ? "" : String(v.monto_flete),
  };
}

export function borradorSucio(v: HrViajeItem, b: Borrador): boolean {
  const o = borradorDe(v);
  const claves: (keyof Borrador)[] = [
    "origen", "destino", "km", "kmVacios", "toneladas", "remito", "monto",
  ];
  return claves.some((k) => b[k].trim() !== o[k].trim());
}


/**
 * El borrador tal como lo espera el server, con SÓLO los campos que cambiaron.
 *
 * Mandarlos todos era un pisotón silencioso: el borrador guarda lo que había
 * cuando se abrió la pantalla, así que corregir el origen de una fila también
 * reescribía el importe y el tonelaje con los valores viejos. Si en el medio
 * alguien cargó el DM de YPF, o el importe desde el listado, eso se borraba —y
 * facturado/cobrado volvían a false— sin que nada lo avisara.
 *
 * Los campos que quedan en `undefined` el server los ignora.
 */
export function aCambio(v: HrViajeItem, b: Borrador): CambioViajeHr {
  const o = borradorDe(v);
  const texto = (x: string) => x.trim() || null;
  const num = (x: string) => {
    if (x.trim() === "") return null;
    const n = parseFloat(x);
    return Number.isNaN(n) ? null : n;
  };
  // km y km vacíos son NOT NULL en la base: vaciar la celda significa cero, no
  // "sin dato". Mandar null hacía fallar el guardado del lote entero.
  const numCero = (x: string) => num(x) ?? 0;

  const c: CambioViajeHr = { id: v.id };
  if (b.origen.trim() !== o.origen.trim()) c.origen_nombre = texto(b.origen);
  if (b.destino.trim() !== o.destino.trim()) c.destino_nombre = texto(b.destino);
  if (b.km.trim() !== o.km.trim()) c.km_con_carga = numCero(b.km);
  if (b.kmVacios.trim() !== o.kmVacios.trim()) c.km_vacios = numCero(b.kmVacios);
  if (b.toneladas.trim() !== o.toneladas.trim()) c.tonelaje_real = num(b.toneladas);
  if (b.remito.trim() !== o.remito.trim()) c.nro_remito = texto(b.remito);
  if (b.monto.trim() !== o.monto.trim()) c.monto_flete = num(b.monto);
  return c;
}
