import "server-only";
import type { TarifaGasoil } from "@/domain/gasoil/litros-por-tonelada";
import type { ChoferParaEnlace } from "./tipos";

/**
 * Las lecturas del enlace público.
 *
 * Están en su propio módulo —sin `"use server"`— porque las usan las dos puntas:
 * la página, que las pinta, y la acción, que **vuelve a leerlas para verificar**.
 * Que sean las mismas funciones no es comodidad: es lo que garantiza que el
 * servidor valide contra exactamente el mismo universo que se le ofreció al
 * chofer, y no contra uno parecido escrito dos veces.
 */

// Las tablas de gasoil son nuevas y no están en `database.ts` generado, así que
// el cliente va tipado como `any` — mismo criterio que en el resto del módulo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** El cuadro de rindes vigente, ya resuelto a nombres. */
export async function leerTarifas(supabase: SB): Promise<TarifaGasoil[]> {
  const { data } = await supabase
    .from("gasoil_tarifas")
    .select(
      "origen_id, destino_id, litros_por_tonelada, origen:puntos_ruta!gasoil_tarifas_origen_id_fkey(nombre), destino:puntos_ruta!gasoil_tarifas_destino_id_fkey(nombre)",
    );

  const uno = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nombre?: string } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map((r) => ({
      origenId: String(r.origen_id),
      destinoId: String(r.destino_id),
      origen: String(uno(r.origen)?.nombre ?? "—"),
      destino: String(uno(r.destino)?.nombre ?? "—"),
      litrosPorTonelada: Number(r.litros_por_tonelada) || 0,
    }))
    .filter((t) => t.litrosPorTonelada > 0);
}

/**
 * Los choferes que pueden anotar una vuelta.
 *
 * Sólo el id y el nombre: esta lista viaja a una página **pública**, así que no
 * sale de acá ni un teléfono ni un DNI ni nada que no esté ya en la puerta del
 * camión. Y sólo los activos: un egresado con el enlace guardado en el teléfono
 * no se autoriza gasoil.
 */
export async function leerChoferesDelEnlace(supabase: SB): Promise<ChoferParaEnlace[]> {
  const { data } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, estado, rol, es_demo")
    .eq("estado", "activo")
    .order("apellido");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .filter((c) => !c.es_demo)
    .filter((c) => (c.rol ?? "chofer") === "chofer" || c.rol === "fletero")
    .map((c) => ({
      id: String(c.id),
      nombre: [c.apellido, c.nombre].filter(Boolean).join(" ").trim() || "(sin nombre)",
    }));
}

/** ¿Este token corresponde a un enlace vivo? */
export async function enlaceActivo(supabase: SB, token: string): Promise<boolean> {
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return false;
  const { data } = await supabase
    .from("gasoil_enlace")
    .select("id")
    .eq("token", token)
    .eq("activo", true)
    .maybeSingle();
  return Boolean(data);
}
