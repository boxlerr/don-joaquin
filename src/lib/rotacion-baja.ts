import "server-only";

import {
  anioDeBaja,
  cuentaParaRotacion,
  mesesEntreFechas,
  tipoBajaDesdeMotivo,
} from "@/domain/rotacion/baja-desde-legajo";
import { antiguedadTexto } from "@/app/(dashboard)/choferes/rotacion/compute";

/**
 * Mantener las bajas de rotación al día con los egresos del legajo.
 *
 * Bárbara, 31/08/2026: *"yo ahí saqué dos de los legajos y no se actualizó en las
 * bajas... A ver, para qué actualizo la pantalla. No, sigue igual"*.
 *
 * Eran dos registros que no se hablaban. Ahora egresar a alguien deja la fila en
 * `rotacion_bajas`, y reactivarlo se la lleva.
 *
 * **Nunca pisa lo cargado a mano.** Las 16 bajas que hay hoy vinieron del Excel
 * y tienen `chofer_id` en null; las que deja esto lo llevan puesto. Esa es la
 * llave: si ya hay una fila para ese chofer, se deja como está — quien la editó
 * a mano sabía más que nosotros.
 */

/** Falla en silencio: un problema acá nunca puede impedir egresar a alguien. */
export async function sincronizarBajaRotacion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  chofer: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    rol: string | null;
    localidad: string | null;
    fecha_ingreso: string | null;
  },
  datos: { motivo: string; fecha_egreso: string; observacion?: string },
  userId: string,
): Promise<{ creada: boolean; motivo?: string }> {
  try {
    // Los fleteros no entran en el índice: son terceros, no nómina.
    if (!cuentaParaRotacion(chofer.rol)) {
      return { creada: false, motivo: "fletero" };
    }

    const { data: yaHay } = await supabase
      .from("rotacion_bajas")
      .select("id")
      .eq("chofer_id", chofer.id)
      .maybeSingle();
    if (yaHay) return { creada: false, motivo: "ya_existia" };

    const meses = mesesEntreFechas(chofer.fecha_ingreso, datos.fecha_egreso);
    const nombre = [chofer.apellido, chofer.nombre].filter(Boolean).join(" ").trim();

    const { error } = await supabase.from("rotacion_bajas").insert({
      chofer_id: chofer.id,
      // `nombre` es NOT NULL. Sin apellido ni nombre no hay fila que valga.
      nombre: nombre || "(sin nombre)",
      fecha_ingreso: chofer.fecha_ingreso,
      fecha_egreso: datos.fecha_egreso,
      anio: anioDeBaja(datos.fecha_egreso, new Date().getFullYear()),
      antiguedad_meses: meses,
      antiguedad_texto: meses == null ? null : antiguedadTexto(meses),
      tipo_baja: tipoBajaDesdeMotivo(datos.motivo),
      motivo: datos.observacion?.trim() || null,
      base_zona: chofer.localidad,
      observaciones: "Se cargó sola al egresar el legajo.",
      created_by: userId,
      updated_by: userId,
    });
    if (error) {
      console.error("[rotacion] no se pudo crear la baja del egreso:", error);
      return { creada: false, motivo: "error" };
    }
    return { creada: true };
  } catch (e) {
    console.error("[rotacion] no se pudo crear la baja del egreso:", e);
    return { creada: false, motivo: "error" };
  }
}

/**
 * Se reactivó a alguien: la baja que dejó su egreso ya no corresponde.
 *
 * Borra SÓLO la que tiene su `chofer_id`, que es la que puso el sistema. Las del
 * Excel lo tienen en null y no las toca ni por casualidad: un egreso deshecho no
 * puede llevarse puesto el histórico que alguien cargó a mano.
 */
export async function borrarBajaRotacionDe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  choferId: string,
): Promise<void> {
  try {
    await supabase.from("rotacion_bajas").delete().eq("chofer_id", choferId);
  } catch (e) {
    console.error("[rotacion] no se pudo borrar la baja al reactivar:", e);
  }
}
