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
  Lightbulb,
  CheckCircle2,
  User,
  FileText,
  MapPin,
  RefreshCw,
  Phone,
  Calendar,
  Wallet,
  Zap,
  LogOut,
  RotateCcw,
  Trophy,
  CreditCard,
  Stethoscope,
  Coins,
  AlertTriangle,
} from "lucide-react";

type TabId = "manual" | "legajo" | "acciones";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "manual", label: "Crear chofer", icon: <Plus size={14} /> },
  { id: "legajo", label: "Legajo digital", icon: <FileText size={14} /> },
  { id: "acciones", label: "Acciones rápidas", icon: <Zap size={14} /> },
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
        className="size-9 rounded-md border border-border bg-card text-primary hover:bg-muted inline-flex items-center justify-center"
      >
        <HelpCircle size={18} />
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(720px,calc(100vw-2rem))] max-h-[90vh] flex flex-col bg-card rounded-[12px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="size-8 rounded-lg bg-[#E1F5FE] text-primary inline-flex items-center justify-center shrink-0">
                <HelpCircle size={18} />
              </span>
              <div>
                <Dialog.Title className="text-foreground text-sm font-bold">
                  Guía de Gestión
                </Dialog.Title>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Tabs inside header */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
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
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground")
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
                            : "bg-card text-muted-foreground/70 border border-border")
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
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full">
              Paso {step + 1} de {totalSteps}
            </div>
          </div>

          {/* Side-by-Side Content */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left Column: Instructions */}
            <div className="w-[280px] border-r border-[#F1F5F9] flex flex-col p-5 overflow-y-auto no-scrollbar">
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
            <div className="flex-1 bg-muted/40 flex flex-col overflow-hidden">
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[440px] transform transition-all duration-500 scale-[0.95]">
                  <div className="relative rounded-xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 h-8 border-b border-[#F1F5F9] bg-muted/40">
                      <div className="flex gap-1">
                        <div className="size-2 rounded-full bg-[#FF5F56]/30" />
                        <div className="size-2 rounded-full bg-[#FFBD2E]/30" />
                        <div className="size-2 rounded-full bg-[#27C93F]/30" />
                      </div>
                      <div className="flex-1 h-4 rounded-md bg-card border border-border/60 flex items-center px-2">
                        <div className="w-16 h-1 bg-muted rounded-full" />
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
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="h-8 px-3 text-sm rounded-md border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-[11px] text-muted-foreground/70">
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
      'En cada card hay un botón "Ver legajo" (o podés hacer clic en su nombre) que te lleva a su página dedicada. Ahí toda la información se organiza en 8 pestañas: Información General, Documentación, Historial Viajes, Cuenta Corriente, Productividad, Apercibimientos, Licencias Médicas y Préstamos.',
    mockup: <MockLegajoTabs />,
  },
  {
    title: "Cargá los datos bancarios",
    description:
      'En "Información General" completás los datos personales y el bloque de datos bancarios: banco, CVU/CBU y alias. Se usan para liquidaciones y transferencias al chofer.',
    mockup: <MockDatosBancarios />,
    hint: "CVU y CBU van en el mismo campo: cargá el que tengas.",
  },
  {
    title: "Cargá la documentación",
    description:
      'En el tab "Documentación" cargás licencia de conducir, ART, libreta sanitaria, etc. Si ponés fecha de vencimiento, el sistema te avisa cuando se acerca (y los vencimientos saltan en las stats de la sección).',
    mockup: <MockDocumentos />,
  },
  {
    title: "Mirá la productividad y el score",
    description:
      'El tab "Productividad" calcula solo los KPIs del chofer: viajes, km, toneladas, eficiencia de gasoil (km/l) y un score que lo ubica en el ranking. No cargás nada a mano, sale de las hojas de ruta y los viajes.',
    mockup: <MockProductividad />,
    hint: "El ranking general y el comparador entre choferes están en /choferes/ranking y /choferes/comparar.",
  },
  {
    title: "Apercibimientos, licencias y préstamos",
    description:
      'Tres tabs administrativos: "Apercibimientos" para sanciones por categoría, "Licencias Médicas" para ausencias con parte médico, y "Préstamos" para adelantos con seguimiento del saldo pendiente.',
    mockup: <MockLegajoAdmin />,
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
    title: "Ver legajo y viajes asociados",
    description:
      'En el footer de la card, "Ver legajo" abre la página dedicada del chofer y el ícono de pin abre la sección Viajes ya filtrada por este chofer. Más rápido que ir a Viajes y filtrar a mano.',
    mockup: <MockCardFooter />,
  },
  {
    title: "Cambiar el estado activo/inactivo",
    description:
      'El ícono de flechas circulares cambia al chofer entre "Activo" e "Inactivo". No borra nada — sólo lo saca de las listas activas (por ejemplo, mientras está de licencia larga).',
    mockup: <MockEstadoToggle />,
  },
  {
    title: "Egresar (baja con motivo)",
    description:
      'El ícono ámbar de salida da de baja al chofer. Te pide motivo y fecha de egreso. No se borra: pasa al historial conservando todos sus viajes, documentación y movimientos.',
    mockup: <MockEgresar />,
    hint: "Nunca se elimina un chofer de forma definitiva. La baja preserva el historial operativo completo.",
  },
  {
    title: "Reactivar e historial de egresados",
    description:
      'Los egresados quedan en una sección colapsable al final del listado. Desde su card, el ícono de reactivar lo vuelve a poner en plantilla. También podés filtrarlos con el selector de estado → "Egresado".',
    mockup: <MockReactivar />,
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
      <div className="opacity-50 transition-opacity">
        <div className="text-foreground text-sm font-bold uppercase tracking-tight">Choferes</div>
        <div className="text-muted-foreground text-[10px] mt-0.5">
          Legajo digital — sin acceso
        </div>
      </div>
      <div className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white transition-all scale-105">
        <Plus size={14} /> Nuevo chofer
      </div>
    </div>
  );
}

function MockNewChoferForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] bg-card">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Nuevo chofer</div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Apellido *" value="Pérez" required />
          <MockField label="Nombre *" value="Juan" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="DNI *" value="30.123.456" required />
          <MockField label="Teléfono" value="+54 9 22…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Localidad" value="Tres Arroyos" />
          <MockField label="Fecha ingreso" value="01/06/2024" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
          <div className="h-8 px-3 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center hover:bg-muted/40">
            Cancelar
          </div>
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-bold shadow-sm">
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
      <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div
        className={
          "h-7 px-2 text-[11px] rounded border bg-card text-foreground inline-flex items-center w-full " +
          (required ? "border-[#0088D1]/60" : "border-border")
        }
      >
        {value}
      </div>
    </div>
  );
}

function MockChoferCard() {
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-sm overflow-hidden max-w-[280px] mx-auto">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0088D1] to-[#4FC3F7]" />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-primary font-bold text-sm shrink-0">
            PJ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-foreground font-semibold text-xs">Pérez, Juan</div>
            <div className="text-muted-foreground text-[10px] font-mono mt-0.5">DNI 30.123.456</div>
            <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-1.5 py-0.5">
              Activo
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#F1F5F9] space-y-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-muted-foreground/70" /> +54 9 22…
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="text-muted-foreground/70" /> Tres Arroyos
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-muted-foreground/70" /> Ingreso: 01/06/2024
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
        <div className="w-16 h-16 rounded-full bg-[#E1F5FE] border-2 border-[#B3E5FC] flex items-center justify-center text-primary font-bold text-lg shadow-inner ring-4 ring-[#0088D1]/15">
          PJ
        </div>
        <div className="absolute inset-0 rounded-full bg-black/55 flex flex-col items-center justify-center text-white">
          <Camera size={14} />
          <span className="text-[8px] font-medium tracking-wider uppercase mt-0.5">Subir</span>
        </div>
      </div>
      <div className="text-primary text-lg">→</div>
      <div className="w-16 h-16 rounded-full border-2 border-[#B3E5FC] overflow-hidden bg-[#E1F5FE] flex items-center justify-center text-primary">
        <User size={28} />
      </div>
    </div>
  );
}

function MockLegajoTabs() {
  const tabs = [
    "Información General",
    "Documentación",
    "Historial Viajes",
    "Cuenta Corriente",
    "Productividad",
    "Apercibimientos",
    "Licencias Médicas",
    "Préstamos",
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center gap-2 text-[11px] text-foreground">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center font-bold text-[10px]">
          PJ
        </span>
        <span className="font-semibold">Pérez, Juan</span>
      </div>
      <div className="p-2 flex flex-wrap gap-1">
        {tabs.map((t, i) => (
          <span
            key={t}
            className={
              "px-2 py-1 rounded text-[10px] font-medium border " +
              (i === 0
                ? "bg-[#E1F5FE] text-primary border-[#0088D1]/40"
                : "bg-card text-muted-foreground border-border")
            }
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function MockDatosBancarios() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        <CreditCard size={11} className="text-primary" /> Datos bancarios
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="text-muted-foreground">Banco</span>
        <span className="text-foreground font-medium">Banco Nación</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-[#0088D1]/40 bg-[#E1F5FE]/40">
        <span className="text-muted-foreground">CVU/CBU</span>
        <span className="text-foreground font-mono">0000003100…</span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="text-muted-foreground">Alias</span>
        <span className="text-foreground font-mono">perez.juan.dj</span>
      </div>
      <div className="text-[10px] text-muted-foreground/80 pt-0.5">Se usan para liquidaciones y transferencias.</div>
    </div>
  );
}

function MockProductividad() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <Trophy size={11} className="text-[#F59E0B]" /> Score del chofer
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
          87 · #2 ranking
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Viajes (mes)</div>
          <div className="text-foreground font-bold">24</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Km recorridos</div>
          <div className="text-foreground font-bold">12.480</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Toneladas</div>
          <div className="text-foreground font-bold">820</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-[9px] text-muted-foreground uppercase">Gasoil km/l</div>
          <div className="text-[#065F46] font-bold">3,1</div>
        </div>
      </div>
    </div>
  );
}

function MockLegajoAdmin() {
  return (
    <div className="space-y-1.5 text-[11px]">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card">
        <AlertTriangle size={12} className="text-[#F59E0B]" />
        <span className="text-foreground flex-1">Apercibimiento — Demora reiterada</span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">Leve</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card">
        <Stethoscope size={12} className="text-primary" />
        <span className="text-foreground flex-1">Licencia médica — 3 días</span>
        <span className="text-[10px] text-muted-foreground">con parte</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-card">
        <Coins size={12} className="text-[#065F46]" />
        <span className="text-foreground flex-1">Préstamo — saldo pendiente</span>
        <span className="text-[11px] font-semibold text-[#7F1D1D]">$ 80.000</span>
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Licencia de conducir
        </span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Vigente
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> ART
        </span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">
          Vence en 20 días
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Libreta sanitaria
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
      <div className="bg-card border border-border rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <MapPin size={10} className="text-primary" /> Historial viajes
        </div>
        <div className="text-[11px] text-foreground">Tres Arroyos → CABA</div>
        <div className="text-[10px] text-muted-foreground">12/03/2026 · 580 km</div>
        <div className="text-[11px] text-foreground">Bahía Blanca → Mar del Plata</div>
        <div className="text-[10px] text-muted-foreground">08/03/2026 · 480 km</div>
      </div>
      <div className="bg-card border border-border rounded-md p-2 space-y-1">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Wallet size={10} className="text-primary" /> Cuenta corriente
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground">Viático ruta</span>
          <span className="text-[#065F46] font-semibold">+ $ 25.000</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground">Anticipo</span>
          <span className="text-[#7F1D1D] font-semibold">- $ 50.000</span>
        </div>
      </div>
    </div>
  );
}

function MockEstadoToggle() {
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-md p-2 flex items-center justify-between">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
            Activo
          </span>
        </div>
        <div className="size-7 rounded-md text-amber-500 hover:bg-card border border-border inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ring-2 ring-amber-300">
          <RefreshCw size={12} />
        </div>
      </div>
      <div className="text-center text-[10px] text-muted-foreground">↓ después del clic</div>
      <div className="bg-card border border-border rounded-md p-2 flex items-center justify-between opacity-80">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">
            Inactivo
          </span>
        </div>
        <div className="size-7 rounded-md text-emerald-500 border border-border inline-flex items-center justify-center">
          <RefreshCw size={12} />
        </div>
      </div>
    </div>
  );
}

function MockCardFooter() {
  return (
    <div className="bg-muted/40 border border-border rounded-md px-3 py-2.5 flex items-center justify-between gap-1">
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
        <User size={12} /> Ver legajo
      </div>
      <div className="flex items-center gap-1">
        <div className="size-8 rounded-md text-primary border border-[#0088D1] inline-flex items-center justify-center" title="Ver viajes">
          <MapPin size={13} />
        </div>
        <div className="size-8 rounded-md text-amber-500 border border-border inline-flex items-center justify-center">
          <RefreshCw size={13} />
        </div>
        <div className="size-8 rounded-md text-amber-500 border border-border inline-flex items-center justify-center">
          <LogOut size={13} />
        </div>
      </div>
    </div>
  );
}

function MockEgresar() {
  return (
    <div className="bg-card border border-amber-200 rounded-md overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="text-xs text-foreground"><b>Pérez, Juan</b></div>
        <div className="size-7 rounded-md text-amber-500 border border-amber-200 bg-amber-50 inline-flex items-center justify-center shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ring-2 ring-amber-300">
          <LogOut size={12} />
        </div>
      </div>
      <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200 text-[10px] space-y-1">
        <div className="flex items-center gap-1.5 text-amber-700 font-semibold uppercase tracking-wide">
          <LogOut size={11} /> Chofer egresado
        </div>
        <div className="text-foreground/90">Motivo: <span className="font-medium">renuncia</span></div>
        <div className="text-foreground/90">Fecha de egreso: 30/04/2026</div>
      </div>
    </div>
  );
}

function MockReactivar() {
  return (
    <div className="space-y-2">
      <div className="w-full bg-card rounded-md border border-border px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Historial de Choferes Egresados</span>
        <span>2 choferes ▾</span>
      </div>
      <div className="bg-card border border-amber-200 rounded-md px-3 py-2 flex items-center justify-between opacity-90">
        <div className="text-xs text-foreground">
          <b>Pérez, Juan</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            Egresado
          </span>
        </div>
        <div className="size-7 rounded-md text-emerald-500 border border-emerald-200 inline-flex items-center justify-center" title="Reactivar">
          <RotateCcw size={12} />
        </div>
      </div>
    </div>
  );
}
