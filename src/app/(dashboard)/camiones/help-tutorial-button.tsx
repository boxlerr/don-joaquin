"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  Plus,
  Upload,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lightbulb,
  CheckCircle2,
  Truck,
  Camera,
  Fuel,
  Wrench,
  FileText,
  Star,
  Receipt,
} from "lucide-react";

type TabId = "manual" | "import" | "detalle";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "manual", label: "Cargar manual", icon: <Plus size={14} /> },
  { id: "import", label: "Importar Excel", icon: <Upload size={14} /> },
  { id: "detalle", label: "Detalle del camión", icon: <Eye size={14} /> },
];

export default function HelpTutorialButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("manual");
  const [step, setStep] = useState(0);

  const steps =
    tab === "manual" ? MANUAL_STEPS : tab === "import" ? IMPORT_STEPS : DETALLE_STEPS;
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
              {/* Tabs inside header to save space */}
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

          {/* Stepper (Simplified and integrated) */}
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
// Pasos: Cargar manual
// =============================================================================

const MANUAL_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Agregar camión"',
    description:
      'Arriba a la derecha de la página, hacé clic en el botón azul "+ Agregar camión". Se abre un modal centrado.',
    mockup: <MockToolbar highlight="new" />,
  },
  {
    title: "Completá los datos del vehículo",
    description:
      "Patente, marca, modelo, año, capacidad (TN) y tipo son obligatorios. El estado por defecto es Activo.",
    mockup: <MockNewCamionForm />,
    hint: "La patente se guarda siempre en mayúsculas. Si te equivocás de formato, vas a ver el error antes de guardar.",
  },
  {
    title: "Guardar y listo",
    description:
      'Apretá "Guardar camión". Vas a ver un mensaje verde de confirmación y el modal se cierra solo. El camión aparece en la flota ordenado por patente.',
    mockup: <MockCamionListItem />,
  },
];

// =============================================================================
// Pasos: Importar Excel
// =============================================================================

const IMPORT_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Importar"',
    description:
      'En la barra superior, al lado de "Exportar", hay un botón "Importar". Hacé clic.',
    mockup: <MockToolbar highlight="import" />,
  },
  {
    title: "Subí el archivo",
    description:
      "Elegí un .xlsx o .csv con las columnas: Patente, Marca, Modelo, Año, Capacidad TN, Tipo, Estado.",
    mockup: <MockImportSelect />,
    hint: (
      <>
        Para <b>tipo</b> usá:{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">tractor</code>,{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">chasis_rigido</code>,{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">batea</code> u{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">otro</code>. Para{" "}
        <b>estado</b>:{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">activo</code>,{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">inactivo</code>,{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">en_mantenimiento</code> o{" "}
        <code className="text-[11px] bg-card border border-border px-1 rounded">baja</code>.
      </>
    ),
  },
  {
    title: "Revisá la vista previa",
    description:
      "Antes de importar nada, vas a ver una tabla con cada fila marcada en verde si es válida o en rojo con el motivo si tiene errores. Nada se guarda todavía.",
    mockup: <MockImportPreview />,
  },
  {
    title: "Confirmá la importación",
    description:
      'Apretá "Confirmar X registros". Sólo se importan las filas válidas; las filas con error quedan afuera.',
    mockup: <MockImportConfirm />,
    hint: "Si te quedaron filas en rojo, corregí esas filas en el Excel y volvé a importar el archivo entero. Las válidas vuelven a entrar (la patente repetida se omite).",
  },
];

// =============================================================================
// Pasos: Detalle del camión
// =============================================================================

const DETALLE_STEPS: TutorialStep[] = [
  {
    title: "Clic en una fila para abrir el detalle",
    description:
      "Cada camión de la lista es clickeable. Se abre un panel con 6 tabs: Información, Fotos, Services, Gasoil, Gastos y Documentos. En Información también ves el chofer asignado, el acoplado vinculado y el estado de tercerización.",
    mockup: <MockRowClick />,
  },
  {
    title: "Subí fotos del camión",
    description:
      'En el tab "Fotos" podés cargar varias imágenes: frente, lateral, interior, chapa. Marcá una con la estrella para que sea la principal — ésa aparece como avatar en la lista.',
    mockup: <MockFotos />,
    hint: "Las fotos pesan máximo 5MB cada una. Acepta JPG, PNG, WEBP, GIF y HEIC.",
  },
  {
    title: "Registrá services, gasoil y gastos",
    description:
      "Desde los tabs Services y Gasoil cargás mantenimientos y cargas de combustible (el KM se autocompleta con el último registrado). El tab Gastos lista todos los gastos imputados a esa unidad. También podés cargar gasoil, service o un gasto desde los botones de la barra superior, sin abrir el detalle.",
    mockup: <MockServiceGasoil />,
  },
  {
    title: "Subí documentación con vencimiento",
    description:
      'En el tab "Documentos" cargás VTV, seguro, RTO, etc. Si ponés fecha de vencimiento, el sistema te avisa cuando se acerca.',
    mockup: <MockDocumentos />,
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

function MockToolbar({ highlight }: { highlight: "new" | "import" }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <FileDown size={12} /> Exportar
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-all " +
          (highlight === "import"
            ? "bg-card border-2 border-[#0088D1] text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.2)] scale-105"
            : "bg-card border border-border text-muted-foreground opacity-50")
        }
      >
        <Upload size={12} /> Importar
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Fuel size={12} /> Cargar gasoil
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Wrench size={12} /> Registrar service
      </div>
      <div className="h-9 px-3 bg-card border border-border rounded-md text-xs text-muted-foreground inline-flex items-center gap-1 opacity-50">
        <Receipt size={12} /> Registrar gasto
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-all " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105"
            : "bg-[#0088D1] text-white opacity-50")
        }
      >
        <Plus size={12} /> Agregar camión
      </div>
    </div>
  );
}

function MockNewCamionForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] bg-card">
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Agregar nuevo camión</div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Patente *" value="AB123CD" required />
          <MockField label="Estado" value="Activo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Marca *" value="Scania" required />
          <MockField label="Modelo *" value="V200" required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MockField label="Año *" value="2020" required />
          <MockField label="Cap. (TN) *" value="35.0" required />
          <MockField label="Tipo" value="Chasis Rígido" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
          <div className="h-8 px-3 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center hover:bg-muted/40">
            Cancelar
          </div>
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-bold shadow-sm">
            Guardar camión
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

function MockCamionListItem() {
  return (
    <div className="bg-card border border-border rounded-[8px] p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center border border-[#B3E5FC]">
          <Truck size={16} />
        </span>
        <div>
          <div className="text-foreground font-mono font-semibold text-sm">AB123CD</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Scania V200 — 2020</div>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] rounded-full px-2 py-0.5">
        Activo
      </span>
    </div>
  );
}

function MockImportSelect() {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="px-3 py-2 border-b border-border text-foreground text-xs font-semibold">
        Importar camiones
      </div>
      <div className="p-3 space-y-2">
        <div className="text-[11px] text-muted-foreground">
          Subí un .xlsx o .csv con columnas: Patente, Marca, Modelo, Año, Capacidad TN, Tipo, Estado.
        </div>
        <div className="h-8 px-2 rounded border border-dashed border-[#94A3B8] text-[11px] text-muted-foreground bg-muted/40 inline-flex items-center gap-2 w-full">
          <Upload size={12} className="text-primary" /> mi-flota.xlsx
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-7 px-2 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center">
            Cancelar
          </div>
          <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold gap-1">
            <Upload size={11} /> Analizar archivo
          </div>
        </div>
      </div>
    </div>
  );
}

function MockImportPreview() {
  const rows = [
    { ok: true, patente: "AB123CD", marca: "Scania V200", err: "" },
    { ok: true, patente: "CD456EF", marca: "Mercedes Actros", err: "" },
    { ok: false, patente: "", marca: "Volvo FH16", err: "Falta patente" },
    { ok: false, patente: "XY", marca: "Iveco", err: "Capacidad inválida" },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 border-b border-[#F1F5F9] bg-muted/40 flex items-center gap-3 text-[11px]">
        <span className="text-[#059669] font-bold">2 válidas</span>
        <span className="text-[#CBD5E1]">·</span>
        <span className="text-[#DC2626] font-bold">2 con error</span>
        <span className="text-muted-foreground">· Se importarán 2 registros.</span>
      </div>
      <div className="text-[10px] font-mono">
        {rows.map((r, i) => (
          <div
            key={i}
            className={
              "flex items-center gap-2 px-3 py-1.5 border-b border-[#F1F5F9] " +
              (r.ok ? "" : "bg-[#FEF2F2]")
            }
          >
            {r.ok ? (
              <CheckCircle2 size={12} className="text-[#10B981]" />
            ) : (
              <X size={12} className="text-red-500" />
            )}
            <span className="text-muted-foreground w-6">{i + 2}</span>
            <span className="font-semibold text-foreground w-20">{r.patente || "—"}</span>
            <span className="text-muted-foreground flex-1 truncate">{r.marca}</span>
            <span className="text-red-600 text-[10px]">{r.err}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockImportConfirm() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="flex justify-end gap-2">
        <div className="h-7 px-2 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center">
          Volver
        </div>
        <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]">
          <Upload size={11} /> Confirmar 2 registros
        </div>
      </div>
      <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] text-[#075985] p-2">
        <b>2</b> importados, <b>2</b> omitidos.
      </div>
    </div>
  );
}

function MockRowClick() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground grid grid-cols-[1fr,1fr,60px,60px] gap-2">
        <span>Patente</span>
        <span>Marca/Modelo</span>
        <span>Año</span>
        <span>Estado</span>
      </div>
      <div className="px-3 py-2 grid grid-cols-[1fr,1fr,60px,60px] gap-2 items-center bg-[#E1F5FE] ring-2 ring-[#0088D1]">
        <div className="flex items-center gap-2">
          <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center border border-[#B3E5FC]">
            <Truck size={12} />
          </span>
          <span className="text-[11px] font-mono font-semibold text-foreground">AB123CD</span>
        </div>
        <span className="text-[11px] text-foreground">Scania V200</span>
        <span className="text-[11px] text-muted-foreground">2020</span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-1.5 py-0.5 text-center">
          Activo
        </span>
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-primary text-center font-semibold">
        ↓ Se abre el panel del camión
      </div>
    </div>
  );
}

function MockFotos() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">3 fotos</div>
        <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-semibold">
          <Upload size={11} /> Subir foto
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[true, false, false].map((principal, i) => (
          <div
            key={i}
            className="relative aspect-[4/3] rounded-md bg-muted/40 border border-border flex items-center justify-center overflow-hidden"
          >
            <Camera size={18} className="text-muted-foreground/70" />
            {principal && (
              <span className="absolute top-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-[#FEF3C7] text-[#92400E] rounded border border-[#FCD34D]">
                <Star size={8} className="fill-[#F59E0B] text-[#F59E0B]" />
                Principal
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockServiceGasoil() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2 text-[11px]">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border">
        <Wrench size={12} className="text-primary" />
        <span className="text-foreground flex-1">Mantenimiento preventivo</span>
        <span className="font-semibold text-foreground">$ 150.000</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border">
        <Fuel size={12} className="text-primary" />
        <span className="text-foreground flex-1">300 Lts — YPF Arrecifes</span>
        <span className="font-semibold text-foreground">$ 120.000</span>
      </div>
      <div className="text-[10px] text-primary bg-[#E1F5FE] border border-[#B3E5FC] rounded px-2 py-1">
        💡 El KM se autocompleta con el último registrado.
      </div>
    </div>
  );
}

function MockDocumentos() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-1.5 text-[11px]">
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> Seguro
        </span>
        <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] rounded-full px-2 py-0.5">
          Vigente
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> VTV
        </span>
        <span className="text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] rounded-full px-2 py-0.5">
          Vence en 15 días
        </span>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded border border-border">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <FileText size={11} className="text-primary" /> RTO
        </span>
        <span className="text-[10px] text-[#7F1D1D] bg-[#FEF2F2] border border-[#FECACA] rounded-full px-2 py-0.5">
          Vencido
        </span>
      </div>
    </div>
  );
}
