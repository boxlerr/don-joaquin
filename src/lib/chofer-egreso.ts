import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFecha } from "@/lib/utils";

/**
 * Reglas de un chofer egresado (estado = "baja").
 *
 * La idea, en criollo: deja de ser parte de la empresa, devuelve sus cosas y
 * queda guardado absolutamente todo el historial. Lo que YA pasó no se toca ni
 * se esconde (viajes, apercibimientos, licencias, vacaciones tomadas, sueldos
 * liquidados); lo que no se puede es seguir generándole novedades nuevas ni
 * usarlo para asignar cosas nuevas.
 *
 * Por eso el gate va en el servidor y no sólo escondiendo botones: un legajo se
 * abre por URL, y las server actions se pueden llamar igual.
 */

export const MENSAJE_CHOFER_EGRESADO =
  "El chofer está egresado: no se le pueden cargar novedades nuevas. El historial se conserva.";

/**
 * Devuelve un mensaje de error si el chofer está egresado, o null si se puede
 * seguir. Usar en TODA server action que CREE o MODIFIQUE algo del legajo que
 * no sea el legajo en sí (las novedades: ausencias, licencias, apercibimientos,
 * préstamos, documentos, vacaciones, asignación de camión).
 *
 * Los datos del propio legajo (nombre, DNI, CBU, y el egreso mismo) se siguen
 * pudiendo corregir: hace falta para arreglar una carga mal hecha o para
 * reactivar a alguien que volvió.
 */
export async function errorSiEgresado(chofer_id: string): Promise<string | null> {
  if (!chofer_id) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("choferes")
    .select("estado, nombre, apellido, fecha_egreso")
    .eq("id", chofer_id)
    .maybeSingle();

  if (data?.estado !== "baja") return null;

  const quien = `${data.apellido}, ${data.nombre}`;
  const cuando = data.fecha_egreso ? ` el ${formatFecha(data.fecha_egreso)}` : "";
  return `${quien} está egresado${cuando}: no se le pueden cargar novedades nuevas. El historial se conserva tal cual.`;
}

/**
 * Libera el camión que tenga asignado el chofer. Se llama al egresarlo: si se
 * va de la empresa, la unidad queda disponible para otro — dejarla "a nombre de"
 * alguien que ya no está hacía que la planilla diaria y el listado de camiones
 * mostraran una asignación que no existe.
 *
 * El trigger `camiones_sync_chofer_historial` cierra solo el tramo abierto en
 * `chofer_camion_historial`, pero lo cierra con `current_date`. Si el egreso fue
 * antes de hoy, se corrige el `hasta` para que el historial diga hasta cuándo
 * manejó de verdad.
 *
 * Devuelve las patentes liberadas (para poder avisarlo en la UI).
 */
export async function liberarCamionDeChofer(
  chofer_id: string,
  fecha_egreso?: string | null,
): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: camiones } = await supabase
    .from("camiones")
    .select("id, patente")
    .eq("chofer_actual_id", chofer_id);

  if (!camiones?.length) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("camiones")
    .update({ chofer_actual_id: null })
    .eq("chofer_actual_id", chofer_id);
  if (error) return [];

  // El tramo que acaba de cerrar el trigger queda con fecha de hoy. Si el egreso
  // es anterior, el historial estaría diciendo que manejó hasta hoy.
  const hoy = new Date().toISOString().split("T")[0]!;
  if (fecha_egreso && fecha_egreso < hoy) {
    for (const c of camiones) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("chofer_camion_historial")
        .update({ hasta: fecha_egreso })
        .eq("chofer_id", chofer_id)
        .eq("camion_id", c.id)
        .eq("hasta", hoy)
        // Un tramo no puede terminar antes de empezar: si el egreso es anterior
        // al inicio de ESTE tramo, se deja la fecha que puso el trigger.
        .lte("desde", fecha_egreso);
    }
  }

  return camiones.map((c) => c.patente);
}
