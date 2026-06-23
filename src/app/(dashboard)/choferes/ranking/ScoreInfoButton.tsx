"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { HelpCircle, X, TrendingDown, Info } from "lucide-react";

// Penalizaciones del score (valores por defecto, editables en "Configurar criterios").
const PENALIZACIONES: { metrica: string; detalle: string; descuento: string }[] = [
  { metrica: "Siniestro / accidente", detalle: "por cada uno del período", descuento: "−20" },
  { metrica: "Ausencia injustificada", detalle: "por cada falta sin justificar", descuento: "−10" },
  { metrica: "Apercibimiento", detalle: "por cada uno del período", descuento: "−8" },
  { metrica: "Rotura (goma, llanta, etc.)", detalle: "por cada evento del período", descuento: "−5" },
  { metrica: "Visita al taller", detalle: "del camión que maneja", descuento: "−3" },
  { metrica: "Licencia médica activa", detalle: "durante el período", descuento: "−10" },
  { metrica: "Km vacíos", detalle: "más del 40% (pesa poco a propósito)", descuento: "−10" },
  { metrica: "Km vacíos", detalle: "entre 30% y 40%", descuento: "−5" },
];

export default function ScoreInfoButton() {
  const [open, setOpen] = useState(false);

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
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(540px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="size-8 rounded-lg bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <Dialog.Title className="text-foreground text-sm font-bold">
                Cómo se calcula el score operativo
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
          <div className="px-5 py-4 overflow-y-auto space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cada chofer arranca el período con{" "}
              <b className="text-foreground">100 puntos</b>. Solo entran al ranking
              los choferes con al menos un viaje en el período seleccionado. Se
              descuentan puntos según estas métricas:
            </p>

            {/* Tabla de penalizaciones */}
            <div className="rounded-[8px] border border-border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/40 border-b border-border">
                <TrendingDown size={13} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Penalizaciones
                </span>
              </div>
              <ul className="divide-y divide-border">
                {PENALIZACIONES.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.metrica}</p>
                      <p className="text-xs text-muted-foreground">{p.detalle}</p>
                    </div>
                    <span className="text-sm font-bold text-[#EF4444] shrink-0">{p.descuento}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bandas de color */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Bandas del puntaje
              </p>
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
                El puntaje final se acota entre 0 y 100. El ranking ordena de mayor a
                menor score; los choferes sin viajes en el período quedan como{" "}
                <b>&ldquo;Sin actividad&rdquo;</b> al final del listado. Los KM oficiales
                prevalecen sobre los cálculos automáticos.
              </p>
            </div>

            {/* Productividad */}
            <div className="flex items-start gap-2 rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-[#065F46]">
              <Info size={14} className="mt-0.5 shrink-0 text-[#059669]" />
              <p className="text-xs leading-relaxed">
                <b>Facturación</b> (suma de fletes del período, en ARS) y <b>$/km</b>{" "}
                miden productividad y <b>no</b> afectan el score de conducta. Tocá el
                encabezado de cualquier columna para ordenar el ranking por esa métrica.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center gap-1"
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
