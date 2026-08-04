"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X, Phone, User } from "lucide-react";

/**
 * Contactos de emergencia editables.
 *
 * El formato del string guardado y su parseo viven en @/lib/contactos-emergencia:
 * el legajo impreso los necesita desde el servidor y este archivo es "use client".
 * Se re-exportan para no tocar a quien ya los importaba de acá.
 */

export {
  parseContactos,
  stringifyContactos,
  formatContactos,
  type Contacto,
} from "@/lib/contactos-emergencia";
import { parseContactos, stringifyContactos, type Contacto } from "@/lib/contactos-emergencia";


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
      {/* En celular el teléfono y el nombre no entran en el mismo renglón: el
          teléfono queda arriba con el botón de quitar, y el nombre —que es el
          campo largo— se lleva la línea entera. Desde sm vuelven a ir juntos. */}
      {contactos.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <div className="relative order-1 min-w-0 flex-1 sm:w-[8.5rem] sm:flex-none sm:shrink-0">
            <Phone size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={c.tel}
              onChange={(e) => update(i, { tel: e.target.value })}
              placeholder="Teléfono"
              className={`h-8 text-sm pl-7 ${errorClass ?? ""}`}
            />
          </div>
          {contactos.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="order-2 sm:order-3 shrink-0 size-9 sm:size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50"
              title="Quitar contacto"
              aria-label="Quitar contacto"
            >
              <X size={13} />
            </button>
          )}
          <div className="relative order-3 sm:order-2 w-full min-w-0 sm:w-auto sm:flex-1">
            <User size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={c.nombre}
              onChange={(e) => update(i, { nombre: e.target.value })}
              placeholder="Nombre y relación, ej: Maria (esposa)"
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex min-h-9 items-center gap-1 text-[11px] font-medium text-[#0088D1] hover:underline md:min-h-0"
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
