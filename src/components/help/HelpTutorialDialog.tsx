"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

export type TutorialStep = {
  title: string;
  description: React.ReactNode;
  mockup: React.ReactNode;
  hint?: React.ReactNode;
};

export type TutorialTab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  steps: TutorialStep[];
};

/**
 * Diálogo de ayuda reutilizable con layout "side-by-side" (instrucciones a la
 * izquierda, preview a la derecha), stepper, tabs y navegación. Cada sección le
 * pasa sus tabs/pasos como data; el chrome es siempre el mismo.
 */
export default function HelpTutorialDialog({
  title = "Guía de Gestión",
  tabs,
  triggerClassName,
}: {
  title?: string;
  tabs: TutorialTab[];
  /** Override del estilo del botón que abre el tutorial. Por defecto es un
   *  botón "Tutorial" alto (h-9) pensado para las barras de filtros; el header
   *  de una página le pasa uno más chico (h-7) para alinear con sus acciones. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tabId, setTabId] = useState(tabs[0]?.id ?? "");
  const [step, setStep] = useState(0);
  // Solapas ya recorridas hasta el final (para la tilde verde en el header).
  const [completadas, setCompletadas] = useState<Set<string>>(() => new Set());

  const activeTab = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const steps = activeTab?.steps ?? [];
  const totalSteps = steps.length;
  const current = steps[step] ?? steps[0];

  const tabIndex = tabs.findIndex((t) => t.id === tabId);
  const nextTab = tabs[tabIndex + 1];
  const isLastStep = step === totalSteps - 1;

  function changeTab(id: string) {
    setTabId(id);
    setStep(0);
  }

  function completar(id: string) {
    setCompletadas((c) => new Set(c).add(id));
  }

  if (!activeTab || !current) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTabId(tabs[0].id);
          setStep(0);
          setCompletadas(new Set());
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Tutorial de la sección — cómo funciona esta pantalla, paso a paso"
        aria-label="Abrir el tutorial de la sección"
        className={
          triggerClassName ??
          "h-9 px-3 rounded-md border border-border bg-card text-primary hover:bg-muted inline-flex items-center gap-1.5 text-[13px] font-medium"
        }
      >
        <HelpCircle size={16} />
        Tutorial
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* `dvh` en vez de `vh`: en el celular el alto con `vh` incluye la barra
            del navegador y el pie con "Siguiente" quedaba fuera de alcance. */}
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(720px,calc(100vw-2rem))] h-[560px] max-h-[calc(100dvh-2rem)] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header — en celular el título y las solapas van en dos renglones:
              en uno solo, las solapas empujaban al botón de cerrar afuera. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="size-8 rounded-lg bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <div>
                <Dialog.Title className="text-foreground text-sm font-bold">
                  {title}
                </Dialog.Title>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {/* Tabs dentro del header — scrollean de costado si no entran. */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg overflow-x-auto no-scrollbar min-w-0">
                {tabs.map((t) => {
                  const active = t.id === tabId;
                  const done = completadas.has(t.id) && !active;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => changeTab(t.id)}
                      className={
                        "flex items-center gap-1.5 px-2.5 h-7 shrink-0 text-[11px] font-bold transition-all rounded-md whitespace-nowrap " +
                        (active
                          ? "bg-card text-primary shadow-sm"
                          : done
                            ? "text-emerald-600 hover:text-emerald-700"
                            : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {done ? <CheckCircle2 size={13} className="text-emerald-500" /> : t.icon}
                      {t.label}
                    </button>
                  );
                })}
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
          </div>

          {/* Stepper */}
          <div className="px-5 py-2.5 border-b border-[#F1F5F9] bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {steps.map((_, i) => {
                const isDone = i < step;
                const isCurrent = i === step;
                return (
                  <div key={i} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      className={
                        "size-6 rounded-full text-[10px] font-bold inline-flex items-center justify-center transition-all shrink-0 " +
                        (isCurrent
                          ? "bg-[#0088D1] text-white shadow-sm ring-2 ring-[#0088D1]/20"
                          : isDone
                            ? "bg-[#10B981] text-white"
                            : "bg-card text-muted-foreground/70 border border-border")
                      }
                    >
                      {isDone ? <CheckCircle2 size={12} /> : i + 1}
                    </button>
                    {i < totalSteps - 1 && (
                      <div
                        className={
                          "w-6 h-0.5 mx-1 rounded-full " +
                          (isDone ? "bg-[#10B981]" : "bg-[#E2E8F0]")
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full whitespace-nowrap ml-4">
              Paso {step + 1} de {totalSteps}
            </div>
          </div>

          {/* Contenido: lado a lado en desktop, apilado en celular. Con las dos
              columnas fijas, los 280px de instrucciones dejaban ~60px para la
              maqueta y no se entendía nada. */}
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
            {/* Columna izquierda: instrucciones */}
            <div className="w-full md:w-[280px] shrink-0 border-b md:border-b-0 md:border-r border-[#F1F5F9] flex flex-col p-4 sm:p-5 md:overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-foreground text-lg font-bold leading-tight">
                    {current.title}
                  </h3>
                  <p className="text-muted-foreground text-[13px] leading-relaxed">
                    {current.description}
                  </p>
                </div>

                {current.hint && (
                  <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Lightbulb size={14} className="text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369A1]">
                        Pro Tip
                      </span>
                    </div>
                    <p className="text-xs leading-normal opacity-90">{current.hint}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Columna derecha: preview visual — recuadro de tamaño fijo para
                que no cambie de tamaño entre pasos ni entre solapas. */}
            <div className="flex-1 min-h-[220px] bg-muted/40 flex flex-col overflow-hidden p-3 sm:p-6">
              <div className="relative flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 h-8 border-b border-[#F1F5F9] bg-muted/40 shrink-0">
                  <div className="flex gap-1">
                    <div className="size-2 rounded-full bg-[#FF5F56]/30" />
                    <div className="size-2 rounded-full bg-[#FFBD2E]/30" />
                    <div className="size-2 rounded-full bg-[#27C93F]/30" />
                  </div>
                  <div className="flex-1 h-4 rounded-md bg-card border border-border/60 flex items-center px-2">
                    <div className="w-16 h-1 bg-muted rounded-full" />
                  </div>
                </div>
                {/* El mockup se centra en un área de alto fijo; si algún mockup
                    es más alto que el recuadro, hace scroll interno sin empujar
                    el layout. */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 flex items-center justify-center">
                  <div className="w-full max-w-[440px]">{current.mockup}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-5 py-3 border-t border-border flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="h-9 sm:h-8 px-3 text-sm rounded-md border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1 min-w-[92px] sm:min-w-[104px]"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-[11px] text-muted-foreground/70">
              {step + 1} / {totalSteps}
            </span>
            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                className="h-9 sm:h-8 px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center justify-center gap-1 min-w-[92px] sm:min-w-[104px]"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            ) : nextTab ? (
              <button
                type="button"
                onClick={() => { completar(tabId); changeTab(nextTab.id); }}
                className="h-9 sm:h-8 px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center justify-center gap-1 min-w-[92px] sm:min-w-[104px] max-w-[220px]"
                title={`Continuar con “${nextTab.label}”`}
              >
                <span className="truncate">Seguir: {nextTab.label}</span>
                <ChevronRight size={14} className="shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { completar(tabId); setOpen(false); }}
                className="h-9 sm:h-8 px-3 text-sm rounded-md bg-[#10B981] text-white hover:bg-[#059669] inline-flex items-center justify-center gap-1 min-w-[92px] sm:min-w-[104px]"
              >
                <CheckCircle2 size={14} /> Terminar
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Campo simulado reutilizable para los mockups de los tutoriales. */
export function MockField({
  label,
  value,
  required,
  icon,
}: {
  label: string;
  value: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-card text-foreground inline-flex items-center gap-1.5 w-full " +
          (required ? "border-[#0088D1]/60" : "border-border")
        }
      >
        {icon && <span className="text-primary">{icon}</span>}
        {value}
      </div>
    </div>
  );
}
