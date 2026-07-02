import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Bloqueo de acceso fuera del horario laboral (audios Bárbara 02/07).
//
// Con `acceso_horario_activo` prendido, los usuarios NO admin solo pueden usar
// el sistema dentro de la franja [acceso_hora_desde, acceso_hora_hasta] (hora
// argentina). Excepciones: rol admin (Bárbara/Nicolás) y usuarios con el flag
// `acceso_fuera_horario` ("acceso 24 hs", se tilda en /usuarios).
//
// Es un control de USO de la interfaz, pensado para el caso "mirar los números
// fuera de hora": se aplica en el layout del dashboard. Los datos sensibles
// siguen protegidos siempre por permisos/RLS, a cualquier hora.
// ---------------------------------------------------------------------------

export type BloqueoHorario = {
  desde: string; // HH:MM
  hasta: string; // HH:MM
};

/** Hora actual en Argentina como "HH:MM" (independiente del TZ del server). */
function horaArgentina(): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    // Algunos runtimes devuelven "24:xx" para la medianoche con hourCycle h24.
    .replace(/^24/, "00");
}

const HHMM = /^\d{2}:\d{2}$/;

/**
 * Devuelve la franja si el usuario está BLOQUEADO en este momento; null si
 * puede entrar. Falla abierto: ante parámetros rotos o error de DB, no bloquea
 * (mejor un rato de acceso de más que dejar a la empresa afuera del sistema).
 */
export async function getBloqueoHorario(user: CurrentUser): Promise<BloqueoHorario | null> {
  if (user.rol.codigo === "admin") return null;

  try {
    const supabase = createAdminClient();
    const [{ data: params }, { data: fila }] = await Promise.all([
      supabase
        .from("parametros_sistema")
        .select("clave, valor")
        .in("clave", ["acceso_horario_activo", "acceso_hora_desde", "acceso_hora_hasta"]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- columna nueva, database.ts sin regenerar
      (supabase as any).from("usuarios").select("acceso_fuera_horario").eq("id", user.id).single(),
    ]);

    const map = new Map((params ?? []).map((p) => [p.clave, p.valor]));
    if (map.get("acceso_horario_activo") !== "true") return null;
    if ((fila as { acceso_fuera_horario?: boolean } | null)?.acceso_fuera_horario) return null;

    const desde = map.get("acceso_hora_desde") ?? "06:00";
    const hasta = map.get("acceso_hora_hasta") ?? "20:00";
    if (!HHMM.test(desde) || !HHMM.test(hasta) || desde === hasta) return null;

    const ahora = horaArgentina();
    // Franja normal (06:00–20:00) o cruzando medianoche (22:00–06:00).
    const dentro =
      desde < hasta ? ahora >= desde && ahora < hasta : ahora >= desde || ahora < hasta;

    return dentro ? null : { desde, hasta };
  } catch (err) {
    console.error("Error al evaluar el bloqueo por horario:", err);
    return null;
  }
}
