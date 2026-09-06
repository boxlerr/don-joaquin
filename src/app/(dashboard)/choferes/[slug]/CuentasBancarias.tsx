"use client";

// Bloque "Bancarios" del legajo: en qué banco (o bancos) cobra la persona.
//
// Antes era un campo de texto con un solo banco. Se cambió porque hay gente que
// cobra partido —HAIT cobra en Credicoop, Galicia y Francés— y con un solo campo
// había que elegir uno y perder los otros, que es justo el dato que se necesita
// para pagarle: a qué home banking hay que entrar.
//
// El CBU sigue estando pero abajo del banco y como dato opcional: "por ahí el CBU
// no es lo importante, sino que diga en qué banco cobra, ya que de esa manera yo
// entro al banco y la cuenta ya la voy a tener guardada" (Nico, vía Bárbara).

import { Plus, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import BancoChip from "@/components/ui/BancoChip";
import { BANCOS_CONOCIDOS } from "@/lib/bancos";

export type CuentaEditable = {
  id?: string;
  banco: string;
  cbu: string | null;
  alias_cbu: string | null;
  principal: boolean;
};

export function CuentasBancariasView({ cuentas }: { cuentas: CuentaEditable[] }) {
  if (!cuentas.length) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }
  return (
    <ul className="space-y-2">
      {cuentas.map((c, i) => (
        <li key={c.id ?? i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="flex h-5 items-center">
            <BancoChip nombre={c.banco} />
          </span>
          {/* La estrella sólo aparece cuando hay más de una cuenta: en la mayoría
              de los legajos hay una sola y marcarla como "principal" no dice nada. */}
          {c.principal && cuentas.length > 1 && (
            <span
              className="text-[11px] text-muted-foreground"
              title="Donde cobra el grueso del sueldo"
            >
              principal
            </span>
          )}
          {(c.cbu || c.alias_cbu) && (
            <span className="w-full font-mono text-[11px] text-muted-foreground">
              {c.cbu}
              {c.cbu && c.alias_cbu ? " · " : ""}
              {c.alias_cbu}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CuentasBancariasEditor({
  cuentas,
  onChange,
}: {
  cuentas: CuentaEditable[];
  onChange: (cuentas: CuentaEditable[]) => void;
}) {
  const opciones = BANCOS_CONOCIDOS.map((b) => ({ id: b, label: b }));

  const set = (i: number, campo: Partial<CuentaEditable>) =>
    onChange(cuentas.map((c, k) => (k === i ? { ...c, ...campo } : c)));

  const quitar = (i: number) => {
    const resto = cuentas.filter((_, k) => k !== i);
    // Si se borró la principal, la primera que queda toma su lugar: sin ninguna
    // marcada, el legajo no sabría cuál mostrar como el banco de la persona.
    if (resto.length && !resto.some((c) => c.principal)) resto[0] = { ...resto[0], principal: true };
    onChange(resto);
  };

  const marcarPrincipal = (i: number) =>
    onChange(cuentas.map((c, k) => ({ ...c, principal: k === i })));

  return (
    <div className="space-y-2">
      {cuentas.map((c, i) => (
        <div key={c.id ?? `nueva-${i}`} className="rounded-md border border-border p-2 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <PlaceCombobox
                name={`banco-${i}`}
                value={c.banco}
                onValueChange={(v) => set(i, { banco: v })}
                options={opciones}
                placeholder="Banco"
              />
            </div>
            {cuentas.length > 1 && (
              <button
                type="button"
                onClick={() => marcarPrincipal(i)}
                title={c.principal ? "Es donde cobra el grueso" : "Marcar como banco principal"}
                aria-label="Marcar como banco principal"
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border transition-colors ${
                  c.principal
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Star size={14} fill={c.principal ? "currentColor" : "none"} />
              </button>
            )}
            <button
              type="button"
              onClick={() => quitar(i)}
              title="Quitar este banco"
              aria-label="Quitar este banco"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Input
              value={c.cbu ?? ""}
              onChange={(e) => set(i, { cbu: e.target.value })}
              className="h-8 font-mono text-sm"
              placeholder="CVU/CBU (opcional)"
              maxLength={22}
            />
            <Input
              value={c.alias_cbu ?? ""}
              onChange={(e) => set(i, { alias_cbu: e.target.value })}
              className="h-8 text-sm"
              placeholder="Alias (opcional)"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...cuentas,
            { banco: "", cbu: null, alias_cbu: null, principal: cuentas.length === 0 },
          ])
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
      >
        <Plus size={13} /> Agregar banco
      </button>
      {cuentas.length > 1 && (
        <p className="text-[11px] text-muted-foreground">
          La estrella marca dónde cobra el grueso: es el banco que se muestra en las
          listas y en los informes.
        </p>
      )}
    </div>
  );
}
