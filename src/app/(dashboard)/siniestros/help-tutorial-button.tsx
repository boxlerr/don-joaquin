"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Truck,
  User,
  Shield,
  FileText,
  Search,
  Edit,
  Trash2,
  Tag,
  Activity,
} from "lucide-react";

type TabId = "manual" | "gestion";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "manual", label: "Registrar siniestro", icon: <Plus size={14} /> },
  { id: "gestion", label: "Ver y gestionar", icon: <Eye size={14} /> },
];

export default function HelpTutorialButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("manual");
  const [step, setStep] = useState(0);

  const steps = tab === "manual" ? MANUAL_STEPS : GESTION_STEPS;
  const totalSteps = steps.length;
  const current = steps[step];

  function changeTab(t: TabId) {
    setTab(t);
    setStep(0);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTab("manual");
          setStep(0);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ayuda"
        className="size-9 rounded-md border border-[#E2E8F0] bg-white text-[#0088D1] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
      >
        <HelpCircle size={18} />
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(720px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-white rounded-[12px] shadow-2xl border border-[#E2E8F0] transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2.5">
              <span className="size-8 rounded-lg bg-[#E1F5FE] text-[#0088D1] inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <div>
                <Dialog.Title className="text-[#0F172A] text-sm font-bold">
                  Guía de Siniestros
                </Dialog.Title>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Tabs inside header to save space */}
              <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => changeTab(t.id)}
                      className={
                        "flex items-center gap-1.5 px-2.5 h-7 text-[11px] font-bold transition-all rounded-md whitespace-nowrap " +
                        (active
                          ? "bg-white text-[#0088D1] shadow-sm"
                          : "text-[#64748B] hover:text-[#0F172A]")
                      }
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <Dialog.Close
                render={
                  <button
                    type="button"
                    className="size-7 rounded-full text-[#475569] hover:bg-[#F1F5F9] inline-flex items-center justify-center"
                    aria-label="Cerrar"
                  />
                }
              >
                <X size={16} />
              </Dialog.Close>
            </div>
          </div>

          {/* Stepper */}
          <div className="px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => {
                const isDone = i < step;
                const isCurrent = i === step;
                return (
                  <div key={i} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      className={
                        "size-6 rounded-full text-[10px] font-bold inline-flex items-center justify-center transition-all " +
                        (isCurrent
                          ? "bg-[#0088D1] text-white shadow-sm ring-2 ring-[#0088D1]/20"
                          : isDone
                            ? "bg-[#10B981] text-white"
                            : "bg-white text-[#94A3B8] border border-[#E2E8F0]")
                      }
                    >
                      {isDone ? <CheckCircle2 size={12} /> : i + 1}
                    </button>
                    {i < totalSteps - 1 && (
                      <div className={
                        "w-6 h-0.5 mx-1 rounded-full " +
                        (isDone ? "bg-[#10B981]" : "bg-[#E2E8F0]")
                      } />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider bg-[#F1F5F9] px-2 py-0.5 rounded-full">
              Paso {step + 1} de {totalSteps}
            </div>
          </div>

          {/* Side-by-Side Content */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Column: Instructions */}
            <div className="w-[280px] border-r border-[#F1F5F9] flex flex-col p-5 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-[#0F172A] text-lg font-bold leading-tight">
                    {current.title}
                  </h3>
                  <p className="text-[#64748B] text-[13px] leading-relaxed">
                    {current.description}
                  </p>
                </div>

                {current.hint && (
                  <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Lightbulb size={14} className="text-[#0088D1]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0369A1]">Pro Tip</span>
                    </div>
                    <p className="text-xs leading-normal opacity-90">
                      {current.hint}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Visual Preview */}
            <div className="flex-1 bg-[#F8FAFC] flex flex-col overflow-hidden">
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[440px] transform transition-all duration-500 scale-[0.95]">
                  <div className="relative rounded-xl border border-[#E2E8F0] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 h-8 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                      <div className="flex gap-1">
                        <div className="size-2 rounded-full bg-[#FF5F56]/30" />
                        <div className="size-2 rounded-full bg-[#FFBD2E]/30" />
                        <div className="size-2 rounded-full bg-[#27C93F]/30" />
                      </div>
                      <div className="flex-1 h-4 rounded-md bg-white border border-[#E2E8F0]/60 flex items-center px-2">
                        <div className="w-16 h-1 bg-[#F1F5F9] rounded-full" />
                      </div>
                    </div>
                    <div className="p-5 overflow-hidden">
                      {current.mockup}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="h-8 px-3 text-sm rounded-md border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-[11px] text-[#94A3B8]">
              {step + 1} / {totalSteps}
            </span>
            {step === totalSteps - 1 ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center gap-1"
              >
                Entendido
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                className="h-8 px-3 text-sm rounded-md bg-[#0088D1] text-white hover:bg-[#0277BD] inline-flex items-center gap-1"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// =============================================================================
// Pasos: Registrar siniestro
// =============================================================================

const MANUAL_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Registrar Siniestro"',
    description:
      'Arriba a la derecha de la página, hacé clic en el botón azul "+ Registrar Siniestro". Se abre un modal centrado.',
    mockup: <MockToolbar />,
  },
  {
    title: "Completá los datos del siniestro",
    description:
      "Camión, Fecha, Tipo y Estado son obligatorios. Después podés sumar el monto de daños, la compañía de seguro, el N° de reclamo y los terceros involucrados.",
    mockup: <MockNewSiniestroForm />,
    hint: (
      <>
        El <b>tipo</b> puede ser{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">choque</code>,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">robo</code>,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">incendio</code>,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">vandalismo</code>,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">vuelco</code> u{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">otro</code>. El{" "}
        <b>estado</b> arranca en <b>Abierto</b> y lo vas actualizando a medida que avanza la gestión.
      </>
    ),
  },
  {
    title: "Guardar y listo",
    description:
      'Apretá "Registrar siniestro". Vas a ver un mensaje verde de confirmación y el modal se cierra solo. El siniestro aparece en la lista ordenado por fecha y suma a las estadísticas de arriba.',
    mockup: <MockSiniestroListItem />,
  },
];

// =============================================================================
// Pasos: Ver y gestionar
// =============================================================================

const GESTION_STEPS: TutorialStep[] = [
  {
    title: "Buscá y filtrá la lista",
    description:
      "Usá el buscador para encontrar siniestros por patente, chofer, tipo o estado. Las tarjetas de arriba te muestran el total, el costo de daños acumulado y los camiones afectados.",
    mockup: <MockSearch />,
  },
  {
    title: "Clic en una fila para ver el detalle",
    description:
      "Cada siniestro de la lista es clickeable. Se despliega un panel con la unidad afectada y el chofer, los datos del seguro y daños, y la descripción completa del accidente.",
    mockup: <MockRowExpand />,
    hint: "El tipo y el estado se ven como etiquetas de color en la fila, así identificás de un vistazo qué siniestros siguen abiertos.",
  },
  {
    title: "Editá o eliminá el registro",
    description:
      'Dentro del panel desplegado tenés "Editar datos" para actualizar cualquier campo —por ejemplo pasar el estado a En gestión o Cerrado— y "Eliminar" para borrar el registro (te pide confirmación).',
    mockup: <MockEditDelete />,
  },
];

// =============================================================================
// Tipo y mocks
// =============================================================================

type TutorialStep = {
  title: string;
  description: React.ReactNode;
  mockup: React.ReactNode;
  hint?: React.ReactNode;
};

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <div className="text-[#0F172A] text-sm font-bold">Siniestros</div>
        <div className="text-[10px] text-[#94A3B8]">Historial y registro de la flota</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-md border border-[#E2E8F0] bg-white text-[#0088D1] inline-flex items-center justify-center opacity-50">
          <HelpCircle size={16} />
        </div>
        <div className="h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
          <Plus size={12} /> Registrar Siniestro
        </div>
      </div>
    </div>
  );
}

function MockNewSiniestroForm() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] bg-white flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#FEE2E2] text-[#EF4444] inline-flex items-center justify-center">
          <AlertTriangle size={14} />
        </span>
        <div className="text-[#0F172A] text-xs font-bold uppercase tracking-wider">Registrar siniestro</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Camión *" value="AB123CD" icon={<Truck size={11} />} required />
          <MockField label="Chofer" value="Juan Pérez" icon={<User size={11} />} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha *" value="10/05/2026" required />
          <MockField label="Monto daños" value="$ 250.000" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Tipo *" value="Choque" icon={<Tag size={11} />} required />
          <MockField label="Estado *" value="Abierto" icon={<Activity size={11} />} required />
        </div>
        <MockField label="Compañía seguro" value="La Caja" icon={<Shield size={11} />} />
        <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
          <div className="h-8 px-3 text-[11px] rounded-md border border-[#E2E8F0] text-[#64748B] inline-flex items-center">
            Cancelar
          </div>
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-bold shadow-sm gap-1">
            <CheckCircle2 size={11} /> Registrar siniestro
          </div>
        </div>
      </div>
    </div>
  );
}

function MockField({
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
      <div className="text-[10px] font-semibold text-[#475569] mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-white text-[#0F172A] inline-flex items-center gap-1.5 w-full " +
          (required ? "border-[#0088D1]/60" : "border-[#E2E8F0]")
        }
      >
        {icon && <span className="text-[#0088D1]">{icon}</span>}
        {value}
      </div>
    </div>
  );
}

function MockSiniestroListItem() {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-9 rounded-full bg-[#FEE2E2] text-[#EF4444] inline-flex items-center justify-center border border-[#FECACA]">
            <AlertTriangle size={16} />
          </span>
          <div>
            <div className="text-[#0F172A] font-semibold text-sm flex items-center gap-1.5">
              AB123CD
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-50 text-red-700 border-red-200">
                Choque
              </span>
            </div>
            <div className="text-[10px] text-[#475569] mt-0.5">10/05/2026 — Juan Pérez</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-50 text-green-700 border-green-200">
            Abierto
          </span>
          <span className="text-[11px] font-bold text-red-600">$ 250.000</span>
        </div>
      </div>
      <div className="text-[10px] text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] rounded px-2 py-1 inline-flex items-center gap-1 font-semibold">
        <CheckCircle2 size={11} /> Siniestro registrado correctamente
      </div>
    </div>
  );
}

function MockSearch() {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] text-[#64748B] uppercase tracking-wide">Total</div>
          <div className="text-sm font-bold text-[#0F172A]">12</div>
        </div>
        <div className="rounded-md border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] text-[#64748B] uppercase tracking-wide">Costo daños</div>
          <div className="text-sm font-bold text-red-600">$ 1.8M</div>
        </div>
        <div className="rounded-md border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] text-[#64748B] uppercase tracking-wide">Camiones</div>
          <div className="text-sm font-bold text-[#0F172A]">5</div>
        </div>
      </div>
      <div className="h-9 px-2 rounded-md border-2 border-[#0088D1] bg-white text-[11px] text-[#475569] inline-flex items-center gap-2 w-full shadow-[0_0_0_4px_rgba(0,136,209,0.2)]">
        <Search size={13} className="text-[#0088D1]" />
        <span className="text-[#94A3B8]">Buscar patente, chofer, tipo, estado...</span>
      </div>
    </div>
  );
}

function MockRowExpand() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md overflow-hidden">
      <div className="px-3 py-2 grid grid-cols-[1fr,70px,70px] gap-2 items-center bg-[#F8FAFC] ring-2 ring-[#0088D1]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#0088D1]">AB123CD</span>
          <span className="text-[10px] text-[#475569]">Juan Pérez</span>
        </div>
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-50 text-red-700 border-red-200">
          Choque
        </span>
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border bg-green-50 text-green-700 border-green-200">
          Abierto
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#F8FAFC]/40">
        <div className="rounded border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] font-bold text-[#64748B] uppercase flex items-center gap-1 mb-1">
            <Truck size={10} className="text-[#0088D1]" /> Unidad
          </div>
          <div className="text-[10px] text-[#0F172A]">Scania V200</div>
        </div>
        <div className="rounded border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] font-bold text-[#64748B] uppercase flex items-center gap-1 mb-1">
            <Shield size={10} className="text-[#10B981]" /> Seguro
          </div>
          <div className="text-[10px] text-[#0F172A]">La Caja</div>
        </div>
        <div className="rounded border border-[#E2E8F0] bg-white p-2">
          <div className="text-[9px] font-bold text-[#64748B] uppercase flex items-center gap-1 mb-1">
            <FileText size={10} className="text-[#F59E0B]" /> Detalle
          </div>
          <div className="text-[10px] text-[#475569] line-clamp-2">Roce lateral en maniobra...</div>
        </div>
      </div>
      <div className="px-3 py-1.5 border-t border-[#E2E8F0] text-[10px] text-[#0088D1] text-center font-semibold">
        ↑ Clic en la fila para desplegar / ocultar
      </div>
    </div>
  );
}

function MockEditDelete() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-3 space-y-3">
      <div className="text-[10px] text-[#64748B]">Panel del siniestro desplegado</div>
      <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
        <div className="h-7 px-2.5 text-[11px] rounded-md border border-[#E2E8F0] text-[#475569] inline-flex items-center gap-1.5 font-bold">
          <Edit size={11} className="text-[#0088D1]" /> Editar datos
        </div>
        <div className="h-7 px-2.5 text-[11px] rounded-md bg-red-50 text-red-600 border border-red-100 inline-flex items-center gap-1.5 font-bold">
          <Trash2 size={11} /> Eliminar
        </div>
      </div>
      <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] text-[#075985] p-2 flex items-center gap-1.5">
        <Activity size={12} />
        Editá para cambiar el estado a <b>En gestión</b> o <b>Cerrado</b>.
      </div>
    </div>
  );
}
