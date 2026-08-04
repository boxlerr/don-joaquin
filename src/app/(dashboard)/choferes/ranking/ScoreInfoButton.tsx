"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { HelpCircle, X, Info } from "lucide-react";
import {
  CONCEPTOS_META,
  TRAMOS_META,
  RANKING_CRITERIOS_DEFAULT,
  type RankingCriterios,
  type ConceptoKey,
} from "./criterios";

export default function ScoreInfoButton({
  criterios = RANKING_CRITERIOS_DEFAULT,
}: {
  criterios?: RankingCriterios;
}) {
  const [open, setOpen] = useState(false);

  const tramoTxt = (key: ConceptoKey) => {
    const grupo = criterios.tramos[key] as Record<string, number>;
    return TRAMOS_META[key]
      .map((n) => `${n.label} (${n.condicion}): −${Math.round((grupo[n.key] ?? 0) * 100)}%`)
      .join(" · ");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo se calcula el score"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <HelpCircle size={13} />
        ¿Cómo se calcula?
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(620px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="size-8 rounded-lg bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <Dialog.Title className="text-foreground text-sm font-bold">
                Cómo se calcula el score
              </Dialog.Title>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-7 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cada chofer arranca el período con <b className="text-foreground">100 puntos</b>. Cada
              uno de los <b className="text-foreground">8 conceptos</b> puede restar como máximo su{" "}
              <b className="text-foreground">tope</b>, según en qué nivel cae el dato del mes. El
              puntaje de un concepto nunca es negativo y el score final se acota entre 0 y 100.{" "}
              <b className="text-foreground">Los topes y los % son configurables</b> desde
              &ldquo;Configurar criterios&rdquo;.
            </p>

            {/* Tabla de conceptos */}
            <div className="rounded-[8px] border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2 bg-muted/40 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Concepto</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tope</span>
              </div>
              <ul className="divide-y divide-border">
                {CONCEPTOS_META.map((c) => (
                  <li key={c.key} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground">{c.categoria}</p>
                      </div>
                      <span className="text-sm font-bold text-foreground shrink-0 tabular-nums">
                        {criterios.topes[c.key]} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{tramoTxt(c.key)}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bandas de color */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bandas del puntaje</p>
              <div className="grid grid-cols-3 gap-2">
                <Banda color="#10B981" rango="≥ 80" label="Bueno" />
                <Banda color="#F59E0B" rango="60–79" label="Regular" />
                <Banda color="#EF4444" rango="< 60" label="Bajo" />
              </div>
            </div>

            {/* Nota */}
            <div className="flex items-start gap-2 rounded-[8px] border border-[#BAE6FD] bg-[#F0F9FF] px-4 py-3 text-[#075985]">
              <Info size={14} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed">
                Los conceptos por eventos (gomas, seguridad, siniestros, conducta) se miden{" "}
                <b>por mes</b>. Si un concepto no tiene datos cargados (ej. sin cargas de gasoil, sin
                tonelaje), <b>no resta puntos</b>: la ausencia de datos nunca penaliza. La
                facturación y el $/km miden productividad y <b>no</b> afectan el score.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 sm:h-8 w-full sm:w-auto justify-center px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center gap-1"
            >
              Entendido
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Banda({ color, rango, label }: { color: string; rango: string; label: string }) {
  return (
    <div
      className="rounded-[8px] border px-3 py-2 text-center"
      style={{ backgroundColor: `${color}14`, borderColor: `${color}4D` }}
    >
      <p className="text-sm font-bold" style={{ color }}>{rango}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
