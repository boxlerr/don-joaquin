import "server-only";
import type { TarifaGasoil } from "@/domain/gasoil/litros-por-tonelada";
import { estaEnCurso } from "@/domain/gasoil/saldo";
import { partesArgentinas } from "@/domain/gasoil/reporte";
import { hoyArgentina } from "@/lib/fecha-ar";
import type { ChoferParaEnlace, VueltaDelChofer } from "./tipos";

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

/** Cuántos días para atrás ve el chofer.
 *
 *  Siete alcanza para la semana de trabajo y no convierte la pantalla en un
 *  archivo: el que la abre está buscando la vuelta de hoy, no auditando el mes.
 */
export const DIAS_DE_HISTORIAL = 7;

/**
 * Las vueltas del chofer con lo que declaró haber cargado en cada una.
 *
 * Es lo que ve apenas se identifica: la de hoy arriba, con el saldo, y las de
 * los días anteriores abajo. Pedido de Nico del 02/09 — sin el historial, el
 * saldo no se puede leer: el chofer no sabe si los litros que ve son de la
 * vuelta que está haciendo o de otra.
 */
export async function leerVueltasDelChofer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  choferId: string,
): Promise<VueltaDelChofer[]> {
  const hoy = hoyArgentina();
  const desde = new Date(Date.now() - DIAS_DE_HISTORIAL * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("gasoil_autorizaciones")
    .select(
      "id, created_at, toneladas, litros_por_tonelada, litros, origen:puntos_ruta!gasoil_autorizaciones_origen_id_fkey(nombre), destino:puntos_ruta!gasoil_autorizaciones_destino_id_fkey(nombre), cargas:gasoil_cargas_declaradas(id, litros, previa, created_at)",
    )
    .eq("chofer_id", choferId)
    .gte("created_at", `${desde}T00:00:00-03:00`)
    .order("created_at", { ascending: false });

  const uno = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { nombre?: string } | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => {
    const { fecha, hora } = partesArgentinas(String(r.created_at));
    return {
      id: String(r.id),
      fecha,
      hora,
      cantera: String(uno(r.origen)?.nombre ?? "—"),
      destino: String(uno(r.destino)?.nombre ?? "—"),
      toneladas: Number(r.toneladas) || 0,
      litrosPorTonelada: Number(r.litros_por_tonelada) || 0,
      litros: Number(r.litros) || 0,
      enCurso: estaEnCurso(fecha, hoy),
      cargas: ((r.cargas ?? []) as Record<string, unknown>[])
        .map((c) => ({
          id: String(c.id),
          litros: Number(c.litros) || 0,
          previa: Boolean(c.previa),
          hora: partesArgentinas(String(c.created_at)).hora,
        }))
        .sort((a, b) => (a.previa === b.previa ? 0 : a.previa ? -1 : 1)),
    };
  });
}
