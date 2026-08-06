"use client";

/**
 * Dedup de toasts POR USUARIO (no re-avisar lo mismo).
 *
 * - `dj_notif_toasted_<userId>` (localStorage): ids ya toasteados, FIFO cap 500.
 *   Sobrevive a F5 → no se re-toastea la misma alerta cada 60s.
 * - `dj_notif_boot_<userId>` (sessionStorage): marca que el primer poll de esta
 *   pestaña ya pasó. Ese primer poll NO toastea nada: sólo anota lo que ya
 *   existía, para que al minuto siguiente las 48 alertas viejas no salgan de
 *   golpe como si acabaran de aparecer. sessionStorage se limpia al cerrar la
 *   pestaña, y además lo limpiamos al pasar por /login (clearForLogin).
 *
 * El "tenés N pendientes" de cada mañana NO vive acá: es el ResumenDiarioModal,
 * que lleva su propia marca (`dj_resumen_dia_<userId>`, una por día).
 */

const TOASTED_PREFIX = "dj_notif_toasted_";
const BOOT_PREFIX = "dj_notif_boot_";
// Tope FIFO holgado: en el bootstrap marcamos TODAS las no leídas como avisadas,
// así que conviene que entren sin evicción aun con bastante volumen acumulado.
// El recorte muerde SÓLO lo viejo; un lote que por sí solo pase el tope se guarda
// entero (ver addToasted).
const CAP = 500;

function safeLocal(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function getToastedSet(userId: string): Set<string> {
  const ls = safeLocal();
  if (!ls) return new Set();
  try {
    const raw = ls.getItem(TOASTED_PREFIX + userId);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function addToasted(userId: string, ids: string[]): void {
  const ls = safeLocal();
  if (!ls || ids.length === 0) return;
  try {
    const frescos = [...new Set(ids)];
    const previos = [...getToastedSet(userId)].filter((id) => !frescos.includes(id));
    // El tope se le cobra a lo VIEJO, nunca a lo que se acaba de marcar. Antes se
    // recortaba el merge entero por la cabeza y en el bootstrap eso tiraba justo
    // los ids recién anotados: `allIds` llega ordenado crítica→advertencia→info
    // (getResumenUsuario), así que con más de CAP no leídas las descartadas eran
    // las críticas... que son exactamente las que devuelve el top-8 del poll
    // siguiente. Al minuto salían 8 toasts de golpe sin nada nuevo, que es el modo
    // de falla que el bootstrap viene a evitar.
    const espacio = Math.max(0, CAP - frescos.length);
    const capped = [...previos.slice(Math.max(0, previos.length - espacio)), ...frescos];
    ls.setItem(TOASTED_PREFIX + userId, JSON.stringify(capped));
  } catch {
    /* storage lleno o bloqueado: el peor caso es un toast repetido, no rompe nada */
  }
}

export function isBootstrapped(userId: string): boolean {
  const ss = safeSession();
  if (!ss) return false;
  try {
    return ss.getItem(BOOT_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

export function setBootstrapped(userId: string): void {
  const ss = safeSession();
  if (!ss) return;
  try {
    ss.setItem(BOOT_PREFIX + userId, "1");
  } catch {
    /* noop */
  }
}

/**
 * Reinicia la memoria de toasts en el login (se llama desde la pantalla /login).
 * Arrancar de cero es seguro justamente por el bootstrap: el primer poll de la
 * sesión nueva vuelve a anotar todo lo pendiente sin toastear nada.
 *
 * OJO: a propósito no toca `dj_resumen_dia_*`. El pop-up del día se muestra UNA
 * vez por día, no una vez por login: si no, quien entra y sale tres veces por la
 * mañana se lo come tres veces.
 */
export function clearForLogin(): void {
  for (const store of [safeLocal(), safeSession()]) {
    if (!store) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && (k.startsWith(TOASTED_PREFIX) || k.startsWith(BOOT_PREFIX))) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {
      /* noop */
    }
  }
}
