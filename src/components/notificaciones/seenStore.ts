"use client";

/**
 * Dedup de toasts POR USUARIO (no re-avisar lo mismo).
 *
 * - `dj_notif_toasted_<userId>` (localStorage): ids ya toasteados, FIFO cap 200.
 *   Sobrevive a F5 → no se re-toastea la misma alerta cada 60s.
 * - `dj_notif_boot_<userId>` (sessionStorage): marca que ya hubo el toast-resumen
 *   inicial de esta sesión de pestaña. sessionStorage se limpia al cerrar la
 *   pestaña; además lo limpiamos al pasar por /login (clearForLogin) para que tras
 *   loguearte SIEMPRE veas el primer pop-up resumen si tenés sin leer.
 */

const TOASTED_PREFIX = "dj_notif_toasted_";
const BOOT_PREFIX = "dj_notif_boot_";
// Tope FIFO holgado: en el bootstrap marcamos TODAS las no leídas como avisadas,
// así que conviene que entren sin evicción aun con bastante volumen acumulado.
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
    const current = [...getToastedSet(userId)];
    const merged = [...current.filter((id) => !ids.includes(id)), ...ids];
    const capped = merged.slice(Math.max(0, merged.length - CAP));
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
 * Así, tras loguearte, el primer poll vuelve a mostrar el pop-up resumen.
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
