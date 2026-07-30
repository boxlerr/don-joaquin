/**
 * Contactos de emergencia del legajo. El campo `telefono_emergencia` en la DB es
 * un único string; el formato es:
 *
 *   "TEL — NOMBRE (RELACION) | TEL2 — NOMBRE2 (RELACION) | …"
 *
 * - Separador entre contactos: `" | "`.
 * - Dentro de un contacto, teléfono y nombre se unen con `" — "` (guion largo).
 * - Si un contacto tiene varios teléfonos del mismo familiar, van como
 *   "TEL1 / TEL2 — NOMBRE (RELACION)" (no se splitean: el "/" es parte del tel).
 * - Si falta el teléfono, se guarda solo el nombre (ej. "Natalia Drulleña (esposa)").
 *
 * Vive acá y no en el editor porque el editor es un componente de cliente, y el
 * legajo impreso —que se arma en el servidor— necesita el mismo parseo. Duplicar
 * el formato en dos lados es la forma segura de que se desincronicen.
 */

export type Contacto = { tel: string; nombre: string };

export function parseContactos(raw: string | null | undefined): Contacto[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(" | ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseUno);
}

function parseUno(s: string): Contacto {
  // Tolerante a ambos guiones (— y -) por si alguien edita a mano.
  const m = s.match(/^(.+?)\s+[—-]\s+(.+)$/);
  if (m) return { tel: m[1].trim(), nombre: m[2].trim() };
  // No hay separador: deducir por contenido (≥7 dígitos = es teléfono).
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 7) return { tel: s.trim(), nombre: "" };
  return { tel: "", nombre: s.trim() };
}

export function stringifyContactos(cs: Contacto[]): string {
  return cs
    .map((c) => ({ tel: c.tel.trim(), nombre: c.nombre.trim() }))
    .filter((c) => c.tel || c.nombre)
    .map((c) => (c.tel && c.nombre ? `${c.tel} — ${c.nombre}` : c.tel || c.nombre))
    .join(" | ");
}

/** Una línea por contacto, para mostrar o imprimir. */
export function formatContactos(raw: string | null | undefined): string {
  return parseContactos(raw)
    .map((c) => [c.tel, c.nombre].filter(Boolean).join(" — "))
    .join("   ·   ");
}
