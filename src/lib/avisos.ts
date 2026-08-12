import "server-only";

/**
 * Avisar que una sección cambió, para que las pantallas abiertas se enteren sin
 * que nadie toque F5.
 *
 * Cómo funciona: el servidor le manda un mensaje a Realtime por HTTP y Supabase
 * se lo reparte a los navegadores que estén escuchando ese canal. El WebSocket
 * va del navegador a Supabase directo, sin pasar por Vercel, así que tener diez
 * pantallas abiertas todo el día no cuesta una sola invocación. El poll que
 * había antes en la caja costaba dos llamadas cada quince segundos por pestaña,
 * hubiera o no novedades.
 *
 * EL MENSAJE NO LLEVA DATOS. Sólo el nombre de la sección. El navegador se
 * entera de que hay algo nuevo y vuelve a pedir los datos por la misma acción
 * de siempre, que es la que aplica los permisos y esconde lo confidencial. Si
 * el aviso trajera la fila, se saltearía todo eso.
 *
 * Por qué HTTP y no un trigger en la base: se probó el trigger con
 * `realtime.send()` y en este proyecto no manda nada, sin dar error. Está
 * explicado en `supabase/migrations/20260812_avisos_en_vivo.sql`.
 */

/** Las secciones que avisan. Agregar una es sumarla acá y escucharla en la pantalla. */
export type SeccionEnVivo = "caja" | "viajes" | "planilla-diaria";

/** Si Realtime no contesta en este plazo, se abandona: avisar no puede demorar una carga. */
const TIMEOUT_MS = 1500;

export function canalDe(seccion: SeccionEnVivo): string {
  return `cambios:${seccion}`;
}

/**
 * Manda el aviso. Nunca tira y nunca hace fallar lo que la llamó.
 *
 * Se llama DESPUÉS de que el guardado salió bien. Que el aviso falle es que
 * alguien vea los datos un rato más tarde; que falle el guardado es otra cosa.
 * Por eso todo está dentro del try y el error sólo se loguea.
 */
export async function avisarCambio(seccion: SeccionEnVivo): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: canalDe(seccion),
            event: "cambio",
            // Sin datos de la fila, a propósito.
            payload: { seccion },
            // Privado: para recibirlo hay que tener sesión y estar activo
            // (policy "escuchar avisos de cambios" sobre realtime.messages).
            private: true,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    // A propósito no se propaga: la carga ya entró y es lo que importa.
    console.warn(`[avisos] no se pudo avisar el cambio de ${seccion}:`, e);
  }
}
