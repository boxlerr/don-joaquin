"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  Plus,
  Camera,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  User,
  FileText,
  MapPin,
  RefreshCw,
  Trash2,
  Phone,
  Calendar,
  Wallet,
} from "lucide-react";

type TabId = "manual" | "legajo" | "acciones";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "manual", label: "Crear chofer", icon: <Plus size={14} /> },
  { id: "legajo", label: "Legajo digital", icon: <FileText size={14} /> },
  { id: "acciones", label: "Acciones rápidas", icon: <Sparkles size={14} /> },
];

export default function HelpTutorialButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("manual");
  const [step, setStep] = useState(0);

  const steps =
    tab === "manual" ? MANUAL_STEPS : tab === "legajo" ? LEGAJO_STEPS : ACCIONES_STEPS;
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
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-start gap-3">
              <span className="size-9 rounded-full bg-[#E1F5FE] text-[#0088D1] inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <div>
                <Dialog.Title className="text-[#0F172A] text-base font-semibold">
                  Cómo gestionar choferes
                </Dialog.Title>
                <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                  Paso a paso visual para armar el legajo digital de cada chofer.
                </Dialog.Description>
              </div>
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

          {/* Tabs */}
          <div className="px-5 pt-3 flex items-center gap-1 border-b border-[#E2E8F0]">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => changeTab(t.id)}
                  className={
                    "inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold transition-colors border-b-2 -mb-px " +
                    (active
                      ? "border-[#0088D1] text-[#0088D1]"
                      : "border-transparent text-[#475569] hover:text-[#0F172A]")
                  }
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Stepper */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => {
                const isDone = i < step;
                const isCurrent = i === step;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className="flex items-center gap-2 flex-1 group"
                  >
                    <span
                      className={
                        "size-6 rounded-full text-[11px] font-semibold inline-flex items-center justify-center shrink-0 " +
                        (isCurrent
                          ? "bg-[#0088D1] text-white"
                          : isDone
                            ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]"
                            : "bg-[#F1F5F9] text-[#94A3B8]")
                      }
                    >
                      {isDone ? <CheckCircle2 size={12} /> : i + 1}
                    </span>
                    {i < totalSteps - 1 && (
                      <span
                        className={
                          "h-px flex-1 " +
                          (isDone ? "bg-[#A7F3D0]" : "bg-[#E2E8F0]")
                        }
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="px-5 py-4 overflow-y-auto">
            <h3 className="text-[#0F172A] text-sm font-semibold mb-1">
              Paso {step + 1} de {totalSteps}: {current.title}
            </h3>
            <p className="text-[#475569] text-sm mb-3 leading-relaxed">
              {current.description}
            </p>
            <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              {current.mockup}
            </div>
            {current.hint && (
              <p className="text-[12px] text-[#475569] mt-3 leading-relaxed">
                <span className="font-semibold text-[#0F172A]">Tip:</span>{" "}
                {current.hint}
              </p>
            )}
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
// Pasos: Crear chofer
// =============================================================================

const MANUAL_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Nuevo chofer"',
    description:
      'Arriba a la derecha de la página, hacé clic en el botón azul "+ Nuevo chofer". Se abre un modal centrado.',
    mockup: <MockToolbar />,
  },
  {
    title: "Completá los datos básicos",
    description:
      "Apellido, nombre y DNI son obligatorios. Teléfono, localidad y fecha de ingreso suman al legajo y se ven después en la card.",
    mockup: <MockNewChoferForm />,
    hint: "Los choferes no acceden al sistema. Es gestión administrativa: legajo, viajes asignados y cuenta corriente.",
  },
  {
    title: "Guardar y listo",
    description:
      'Apretá "Guardar chofer". Aparece en el listado como una card ordenada alfabéticamente por apellido.',
    mockup: <MockChoferCard />,
  },
];

// =============================================================================
// Pasos: Legajo digital
// =============================================================================

const LEGAJO_STEPS: TutorialStep[] = [
  {
    title: "Subí la foto de perfil",
    description:
      "En la card del chofer, hacé clic sobre el círculo del avatar para abrir el selector y subir una imagen. Si ya tiene foto, el clic la reemplaza.",
    mockup: <MockAvatarUpload />,
    hint: "Máximo 5 MB por imagen. Acepta JPG, PNG, WEBP, GIF y HEIC.",
  },
  {
    title: 'Abrí el "Legajo digital"',
    description:
      'En cada card hay un botón "Ver legajo" que abre un modal grande con 4 tabs internas: Información, Documentación, Historial Viajes y Cuenta Corriente.',
    mockup: <MockVerLegajo />,
  },
  {
    title: "Cargá la documentación",
    description:
      'En el tab "Documentación" cargás licencia de conducir, ART, libreta sanitaria, etc. Si ponés fecha de vencimiento, el sistema te avisa cuando se acerca.',
    mockup: <MockDocumentos />,
  },
  {
    title: "Mirá viajes y cuenta corriente",
    description:
      'Los tabs "Historial Viajes" y "Cuenta Corriente" muestran lo que el chofer manejó y los movimientos asociados (viáticos, anticipos, etc.) sin que tengas que ir a otra sección.',
    mockup: <MockViajesCuenta />,
  },
];

// =============================================================================
// Pasos: Acciones rápidas
// =============================================================================

const ACCIONES_STEPS: TutorialStep[] = [
  {
    title: "Cambiar el estado activo/inactivo",
    description:
      'El ícono de flechas circulares en el footer de la card cambia al chofer entre "Activo" e "Inactivo". No borra nada — sólo lo saca de las listas activas.',
    mockup: <MockEstadoToggle />,
  },
  {
    title: "Ver viajes asociados",
    description:
      'El ícono de pin abre la sección Viajes filtrada por este chofer. Más rápido que ir a Viajes y filtrar a mano.',
    mockup: <MockVerViajes />,
  },
  {
    title: "Eliminar definitivo (con cuidado)",
    description:
      'El ícono rojo de tacho elimina el chofer del sistema. Si tiene viajes o movimientos asociados, no te va a dejar — usá la baja (paso 1) en su lugar.',
    mockup: <MockEliminar />,
    hint: "Para preservar historial, preferí pasar a Inactivo en vez de eliminar. Los viajes pasados se mantienen y siguen mostrando al chofer.",
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
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-[#0F172A] text-sm font-semibold">Choferes</div>
        <div className="text-[#475569] text-[10px] mt-0.5">
          Legajo digital — sin acceso al sistema
        </div>
      </div>
      <div className="h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]">
        <Plus size={12} /> Nuevo chofer
      </div>
    </div>
  );
}

function MockNewChoferForm() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md shadow-sm w-full max-w-[420px] mx-auto">
      <div className="px-3 py-2 border-b border-[#E2E8F0]">
        <div className="text-[#0F172A] text-xs font-semibold">Nuevo chofer</div>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Apellido *" value="Pérez" required />
          <MockField label="Nombre *" value="Juan" required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField label="DNI *" value="30.123.456" required />
          <MockField label="Teléfono" value="+54 9 22…" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MockField label="Localidad" value="Tres Arroyos" />
          <MockField label="Fecha ingreso" value="01/06/2024" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <div className="h-7 px-2 text-[11px] rounded-md border border-[#E2E8F0] text-[#475569] inline-flex items-center">
            Cancelar
          </div>
          <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold">
            Guardar chofer
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
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-[#475569] mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-white text-[#0F172A] inline-flex items-center w-full " +
          (required ? "border-[#0088D1]/60" : "border-[#E2E8F0]")
        }
      >
        {value}
      </div>
    </div>
  );
}

function MockChoferCard() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-sm overflow-hidden max-w-[280px] mx-auto">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0088D1] to-[#4FC3F7]" />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-[#0088D1] font-bold text-sm shrink-0">
            PJ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[#0F172A] font-semibold text-xs">Pérez, Juan</div>
            <div className="text-[#64748B] text-[10px] font-mono mt-0.5">DNI 30.123.456</div>
            <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-1.5 py-0.5">
              Activo
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#F1F5F9] space-y-1 text-[10px] text-[#475569]">
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-[#94A3B8]" /> +54 9 22…
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="text-[#94A3B8]" /> Tres Arroyos
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-[#94A3B8]" /> Ingreso: 01/06/2024
          </div>
        </div>
      </div>
    </div>
  );
}

function MockAvatarUpload() {
  return (
    <div className="flex items-center gap-6 justify-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-[#0088D1] font-bold text-lg shadow-inner ring-4 ring-[#0088D1]/15">
          PJ
        </div>
        <div className="absolute inset-0 rounded-full bg-black/55 flex flex-col items-center justify-center text-white">
          <Camera size={14} />
          <span className="text-[8px] font-medium tracking-wider uppercase mt-0.5">Subir</span>
        </div>
      </div>
      <div className="text-[#0088D1] text-lg">→</div>
      <div className="w-16 h-16 rounded-full border-2 border-[#B3E5FC] overflow-hidden bg-[#E1F5FE] flex items-center justify-center text-[#0088D1]">
        <User size={28} />
      </div>
    </div>
  );
}

function MockVerLegajo() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md overflow-hidden">
      <div className="bg-[#F8FAFC] px-3 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-[#0F172A]">
          <span className="size-7 rounded-full bg-[#E1F5FE] text-[#0088D1] inline-flex items-center justify-center font-bold text-[10px]">
            PJ
          </span>
          <span className="font-semibold">Pérez, Juan</span>
        </div>
        <div className="h-7 px-2 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]">
          <User size={11} /> Ver legajo
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 text-[10px] border-b border-[#E2E8F0] overflow-x-auto whitespace-nowrap">
        <span className="text-[#0088D1] font-semibold border-b-2 border-[#0088D1] pb-1">Información</span>
        <span className="text-[#475569]">Documentación</span>
        <span className="text-[#475569]">Historial Viajes</span>
        <span className="text-[#475569]">Cuenta Corriente</span>
      </div>
      <div className="p-3 text-center text-[11px] text-[#0088D1] font-semibold">
        ↓ Modal con 4 tabs internas
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-[#E2E8F0]">
        <span className="inline-flex items-center gap-1.5 text-[#0F172A]">
          <FileText size={11} className="text-[#0088D1]" /> Licencia de conducir
        </span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Vigente
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-[#E2E8F0]">
        <span className="inline-flex items-center gap-1.5 text-[#0F172A]">
          <FileText size={11} className="text-[#0088D1]" /> ART
        </span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">
          Vence en 20 días
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-[#E2E8F0]">
        <span className="inline-flex items-center gap-1.5 text-[#0F172A]">
          <FileText size={11} className="text-[#0088D1]" /> Libreta sanitaria
        </span>
        <span className="text-[10px] text-[#7F1D1D] bg-[#FEF2F2] border border-[#FECACA] rounded-full px-2 py-0.5">
          Vencida
        </span>
      </div>
    </div>
  );
}

function MockViajesCuenta() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-wide flex items-center gap-1">
          <MapPin size={10} className="text-[#0088D1]" /> Historial viajes
        </div>
        <div className="text-[11px] text-[#0F172A]">Tres Arroyos → CABA</div>
        <div className="text-[10px] text-[#475569]">12/03/2026 · 580 km</div>
        <div className="text-[11px] text-[#0F172A]">Bahía Blanca → Mar del Plata</div>
        <div className="text-[10px] text-[#475569]">08/03/2026 · 480 km</div>
      </div>
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-wide flex items-center gap-1">
          <Wallet size={10} className="text-[#0088D1]" /> Cuenta corriente
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#0F172A]">Viático ruta</span>
          <span className="text-[#065F46] font-semibold">+ $ 25.000</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#0F172A]">Anticipo</span>
          <span className="text-[#7F1D1D] font-semibold">- $ 50.000</span>
        </div>
      </div>
    </div>
  );
}

function MockEstadoToggle() {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 flex items-center justify-between">
        <div className="text-xs text-[#0F172A]">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
            Activo
          </span>
        </div>
        <div className="size-7 rounded-md text-amber-500 hover:bg-white border border-[#E2E8F0] inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ring-2 ring-amber-300">
          <RefreshCw size={12} />
        </div>
      </div>
      <div className="text-center text-[10px] text-[#475569]">↓ después del clic</div>
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 flex items-center justify-between opacity-80">
        <div className="text-xs text-[#0F172A]">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] rounded-full px-2 py-0.5">
            Inactivo
          </span>
        </div>
        <div className="size-7 rounded-md text-emerald-500 border border-[#E2E8F0] inline-flex items-center justify-center">
          <RefreshCw size={12} />
        </div>
      </div>
    </div>
  );
}

function MockVerViajes() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-[#0F172A]"><b>Pérez, Juan</b></div>
        <div className="size-7 rounded-md text-[#0088D1] border border-[#0088D1] inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
          <MapPin size={12} />
        </div>
      </div>
      <div className="text-center text-[10px] text-[#475569]">↓ abre</div>
      <div className="text-[11px] text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2 py-1.5">
        <span className="font-mono text-[10px] text-[#475569]">/viajes?choferId=…</span>
        <div className="mt-1">→ Listado de viajes filtrado por este chofer</div>
      </div>
    </div>
  );
}

function MockEliminar() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-2 flex items-center justify-between">
      <div className="text-xs text-[#0F172A]"><b>Pérez, Juan</b></div>
      <div className="size-7 rounded-md text-red-500 border border-red-200 bg-red-50 inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(239,68,68,0.15)] ring-2 ring-red-300">
        <Trash2 size={12} />
      </div>
    </div>
  );
}
