/**
 * Borradores locales: lo que alguien está cargando sobrevive a un F5, a cerrar
 * el diálogo sin querer, a que se corte internet y a que se corte la luz.
 *
 * El problema real que ataca: media hora cargando viajes en la carga rápida
 * vive sólo en `useState` hasta que se toca Guardar. Cualquier accidente en el
 * medio y no queda nada. Acá el estado se copia a `localStorage` mientras se
 * tipea, y al volver se ofrece —nunca se restaura solo, que es peor: nadie
 * espera encontrar datos viejos en un formulario que abrió en blanco.
 *
 * Va aparte del hook porque estas reglas —el TTL, el merge contra el vacío, la
 * clave por usuario— son las que hay que tener probadas. El hook es plomería.
 *
 * No confundir con `app/(dashboard)/viajes/hoja-ruta/borradores.ts`: aquel es
 * el diff en memoria de una fila contra su original, y no sobrevive a nada.
 */

/** Cuánto vive un borrador sin tocarse. Pasado esto, molesta más de lo que ayuda. */
export const TTL_DIAS = 7;
const TTL_MS = TTL_DIAS * 24 * 60 * 60 * 1000;

const PREFIJO = "dj:borrador:";

export type BorradorGuardado<T> = { valor: T; ts: number };

/**
 * Toma el crudo de `localStorage` y decide si sirve. Devuelve `null` para
 * descartarlo.
 *
 * Existe porque un borrador guardado la semana pasada puede no tener los campos
 * que el formulario tiene hoy, y no queremos que eso rompa la pantalla.
 */
export type Normalizador<T> = (crudo: unknown) => T | null;

/**
 * La clave lleva el usuario adentro a propósito: en la oficina se comparten
 * máquinas, y que a alguien le aparezca el borrador de otro sería peor que
 * perder el propio.
 */
export function claveBorrador(pantalla: string, userId?: string | null): string {
  return `${PREFIJO}${pantalla}:${userId ?? "anon"}`;
}

/** Normalizador para un formulario: completa contra el vacío lo que falte. */
export function objetoCon<T extends object>(vacio: T): Normalizador<T> {
  return (crudo) => {
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;
    return { ...vacio, ...(crudo as Partial<T>) };
  };
}

/** Normalizador para una grilla: cada fila se completa contra la fila vacía. */
export function listaDe<T extends object>(filaVacia: T): Normalizador<T[]> {
  return (crudo) => {
    if (!Array.isArray(crudo)) return null;
    if (crudo.some((f) => !f || typeof f !== "object" || Array.isArray(f))) return null;
    return crudo.map((f) => ({ ...filaVacia, ...(f as Partial<T>) }));
  };
}

/**
 * Lee el borrador. Devuelve `null` si no hay, si venció, si está corrupto o si
 * el navegador tiene el almacenamiento bloqueado.
 *
 * Un borrador vencido se borra acá mismo: si no, queda ocupando lugar para
 * siempre en una pantalla a la que quizás nadie vuelve.
 */
export function leerBorrador<T>(
  clave: string,
  normalizar: Normalizador<T>,
  ahora: number = Date.now(),
): BorradorGuardado<T> | null {
  let crudo: string | null;
  try {
    crudo = localStorage.getItem(clave);
  } catch {
    return null;
  }
  if (!crudo) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(crudo);
  } catch {
    borrarBorrador(clave);
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    borrarBorrador(clave);
    return null;
  }

  const { valor, ts } = parsed as { valor?: unknown; ts?: unknown };
  const cuando = Number(ts);
  if (!Number.isFinite(cuando) || cuando <= 0) {
    borrarBorrador(clave);
    return null;
  }
  if (ahora - cuando > TTL_MS) {
    borrarBorrador(clave);
    return null;
  }

  const normalizado = normalizar(valor);
  if (normalizado === null) {
    borrarBorrador(clave);
    return null;
  }

  return { valor: normalizado, ts: cuando };
}

/**
 * Guarda y devuelve el momento en que lo hizo, o `null` si no se pudo.
 *
 * Que no se pueda guardar (almacenamiento lleno, modo privado, política del
 * navegador) nunca puede romper la carga: es una red de seguridad, no el
 * camino principal.
 */
export function guardarBorrador<T>(clave: string, valor: T, ahora: number = Date.now()): number | null {
  try {
    localStorage.setItem(clave, JSON.stringify({ valor, ts: ahora } satisfies BorradorGuardado<T>));
    return ahora;
  } catch {
    return null;
  }
}

export function borrarBorrador(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    /* nada que hacer: el borrador es una ayuda, no un requisito */
  }
}

/**
 * Barre los borradores vencidos de todas las pantallas. Corre una vez por
 * sesión, al entrar: sin esto, una pantalla que se dejó de usar se queda con su
 * borrador ocupando lugar hasta que alguien limpie el navegador a mano.
 */
export function limpiarVencidos(ahora: number = Date.now()): number {
  let borrados = 0;
  try {
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIJO)) claves.push(k);
    }
    for (const k of claves) {
      const crudo = localStorage.getItem(k);
      if (!crudo) continue;
      let ts = 0;
      try {
        ts = Number((JSON.parse(crudo) as { ts?: unknown }).ts) || 0;
      } catch {
        // Ilegible: se va igual.
      }
      if (!ts || ahora - ts > TTL_MS) {
        localStorage.removeItem(k);
        borrados++;
      }
    }
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar */
  }
  return borrados;
}

/**
 * "ayer 18:40", "hoy 09:12", "05/08 14:03". Es lo que se le muestra a la
 * persona para que reconozca su borrador; la fecha sola no alcanza para saber
 * si es de esta mañana o de la semana pasada.
 */
export function describirCuando(ts: number, ahora: number = Date.now()): string {
  if (!ts) return "";
  const fecha = new Date(ts);

  // A mano y no con `toLocaleString`: el formato de `es-AR` cambia según el ICU
  // que tenga cada entorno —en los tests sale "7/8 03:30 p. m."— y esto se lee
  // de reojo para decidir si el borrador es el propio. Tiene que ser siempre
  // igual: 24 horas y dos dígitos.
  const dd = (n: number) => String(n).padStart(2, "0");
  const hora = `${dd(fecha.getHours())}:${dd(fecha.getMinutes())}`;

  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDias = Math.round((dia(new Date(ahora)) - dia(fecha)) / (24 * 60 * 60 * 1000));

  if (diffDias === 0) return `hoy ${hora}`;
  if (diffDias === 1) return `ayer ${hora}`;
  return `${dd(fecha.getDate())}/${dd(fecha.getMonth() + 1)} ${hora}`;
}
