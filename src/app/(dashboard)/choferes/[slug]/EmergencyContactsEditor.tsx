"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X, Phone, User } from "lucide-react";

/**
 * Contactos de emergencia editables. El campo `telefono_emergencia` en la DB es
 * un único string; este componente lo serializa así:
 *
 *   "TEL — NOMBRE (RELACION) | TEL2 — NOMBRE2 (RELACION) | …"
 *
 * - Separador entre contactos: `" | "`.
 * - Dentro de un contacto, teléfono y nombre se unen con `" — "` (guion largo).
 * - Si un contacto tiene varios teléfonos del mismo familiar, van como
 *   "TEL1 / TEL2 — NOMBRE (RELACION)" (no se splitean: el "/" es parte del tel).
 * - Si falta el teléfono, se guarda solo el nombre (ej. "Natalia Drulleña (esposa)").
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

interface Props {
  /** Valor serializado actual (string que va a `telefono_emergencia`). */
  value: string;
  onChange: (v: string) => void;
  errorClass?: string;
}

export default function EmergencyContactsEditor({ value, onChange, errorClass }: Props) {
  // Estado local: lista de contactos. Se serializa hacia afuera en cada cambio.
  // Inicializamos siempre con al menos 1 fila para que el usuario pueda escribir.
  const inicial = parseContactos(value);
  const [contactos, setContactos] = useState<Contacto[]>(inicial.length ? inicial : [{ tel: "", nombre: "" }]);

  const emit = (next: Contacto[]) => {
    setContactos(next);
    onChange(stringifyContactos(next));
  };

  const update = (i: number, patch: Partial<Contacto>) => {
    emit(contactos.map((c, j) => (i === j ? { ...c, ...patch } : c)));
  };

  const remove = (i: number) => {
    const next = contactos.filter((_, j) => j !== i);
    emit(next.length ? next : [{ tel: "", nombre: "" }]);
  };

  const add = () => emit([...contactos, { tel: "", nombre: "" }]);

  return (
    <div className="space-y-1.5">
      {contactos.map((c, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <div className="relative w-[8.5rem] shrink-0">
            <Phone size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={c.tel}
              onChange={(e) => update(i, { tel: e.target.value })}
              placeholder="Teléfono"
              className={`h-8 text-sm pl-7 ${errorClass ?? ""}`}
            />
          </div>
          <div className="relative flex-1 min-w-0">
            <User size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={c.nombre}
              onChange={(e) => update(i, { nombre: e.target.value })}
              placeholder="Nombre y relación, ej: Maria (esposa)"
              className="h-8 text-sm pl-7"
            />
          </div>
          {contactos.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50"
              title="Quitar contacto"
              aria-label="Quitar contacto"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0088D1] hover:underline"
      >
        <Plus size={11} /> Agregar otro contacto
      </button>
    </div>
  );
}

/** Vista de solo lectura: parsea el valor y muestra cada contacto en su línea. */
export function EmergencyContactsView({ value }: { value: string | null | undefined }) {
  const cs = parseContactos(value);
  if (cs.length === 0) {
    return <p className="text-sm py-0.5 text-muted-foreground/60">—</p>;
  }
  return (
    <ul className="text-sm py-0.5 space-y-0.5">
      {cs.map((c, i) => (
        <li key={i} className="text-foreground break-words">
          {c.tel && <span className="font-mono">{c.tel}</span>}
          {c.tel && c.nombre && <span className="text-muted-foreground"> · </span>}
          {c.nombre && <span>{c.nombre}</span>}
        </li>
      ))}
    </ul>
  );
}
