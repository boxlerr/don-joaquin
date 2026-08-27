/**
 * El sonido de un aviso nuevo: dos notas cortas, sin archivo.
 *
 * Pedido de Julián (27/08/2026): que el aviso del cheque *"salte tipo red social
 * y además pueda tener un sonido"*. Es para la oficina: el sistema queda abierto
 * en una pestaña todo el día y un cartel en la esquina no alcanza si nadie está
 * mirando la pantalla.
 *
 * Se genera con Web Audio y no con un `<audio src="...">` por tres razones: no
 * hay que subir ni versionar un mp3, no se descarga nada (son dos osciladores) y
 * el volumen queda bajo nuestro control y no del archivo.
 *
 * DOS COSAS QUE NO SON OBVIAS
 *
 * 1. **El navegador no deja sonar nada hasta que la persona toque algo.** Es la
 *    política de autoplay: un AudioContext creado sin un gesto del usuario nace
 *    `suspended` y no suena. Por eso `prepararSonido()` engancha el primer
 *    click/tecla de la sesión, crea el contexto ahí y lo deja listo. Si alguien
 *    abre el sistema y no toca nada durante una hora, el primer aviso va a ser
 *    mudo — y está bien: tampoco hay nadie escuchando.
 *
 * 2. **Se puede apagar, y la preferencia es del DISPOSITIVO.** Va a
 *    localStorage y no a la base a propósito: que suene o no depende de dónde
 *    está sentada la persona (la oficina con parlantes, el teléfono en una
 *    reunión), no de quién es. Nace prendido; un sonido que hay que ir a activar
 *    no lo activa nadie.
 */

const CLAVE = "dj_sonido_avisos";

/** El contexto vive en el módulo: uno solo por pestaña. */
let ctx: AudioContext | null = null;
let enganchado = false;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Safari en privado tira al leer localStorage. Sin preferencia guardada, suena.
    return null;
  }
}

/** ¿Está prendido el sonido en este dispositivo? Por defecto, sí. */
export function sonidoActivo(): boolean {
  return storage()?.getItem(CLAVE) !== "off";
}

export function setSonidoActivo(activo: boolean): void {
  try {
    storage()?.setItem(CLAVE, activo ? "on" : "off");
  } catch {
    /* sin storage, la elección dura lo que la pestaña */
  }
  oyentes.forEach((o) => o());
}

/**
 * Suscripción al cambio de la preferencia, para `useSyncExternalStore`.
 *
 * El botón de la campana lee este valor y no puede hacerlo con un `useState` +
 * `useEffect`: localStorage no existe en el server y leerlo en el primer render
 * rompe la hidratación. Con un store externo, React pide el valor cuando
 * corresponde y en el server usa `sonidoActivoEnServidor`.
 */
const oyentes = new Set<() => void>();

export function suscribirSonido(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** En el server no hay preferencia: se asume prendido, igual que el default. */
export function sonidoActivoEnServidor(): boolean {
  return true;
}

type ConWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function crearContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as ConWebkit).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Deja el audio listo aprovechando el primer gesto de la persona. Llamarla una
 * vez, al montar la app; se desengancha sola.
 */
export function prepararSonido(): void {
  if (enganchado || typeof window === "undefined") return;
  enganchado = true;

  const alTocar = () => {
    window.removeEventListener("pointerdown", alTocar);
    window.removeEventListener("keydown", alTocar);
    ctx = ctx ?? crearContexto();
    // `resume` dentro del gesto es lo que lo desbloquea de verdad.
    void ctx?.resume().catch(() => {});
  };

  window.addEventListener("pointerdown", alTocar, { once: true });
  window.addEventListener("keydown", alTocar, { once: true });
}

/**
 * Dos notas cortas, suaves. Nunca lanza: si el navegador no deja sonar, el aviso
 * igual se ve — el sonido es el acompañamiento, no el mensaje.
 */
export function sonarAviso(): void {
  if (!sonidoActivo()) return;
  const audio = ctx ?? crearContexto();
  if (!audio) return;
  ctx = audio;
  if (audio.state === "suspended") {
    // Puede fallar si todavía no hubo gesto: se intenta y se sigue.
    void audio.resume().catch(() => {});
  }

  try {
    const ahora = audio.currentTime;
    // Mi5 y La5: un intervalo que sube, corto. Ni timbre de casa ni alarma.
    [
      { hz: 659.25, en: 0 },
      { hz: 880, en: 0.11 },
    ].forEach(({ hz, en }) => {
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      // Envolvente: sin la rampa, el corte seco hace "clic".
      vol.gain.setValueAtTime(0.0001, ahora + en);
      vol.gain.exponentialRampToValueAtTime(0.11, ahora + en + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + en + 0.16);
      osc.connect(vol).connect(audio.destination);
      osc.start(ahora + en);
      osc.stop(ahora + en + 0.18);
    });
  } catch {
    /* el aviso ya está en pantalla: el sonido es de más */
  }
}
