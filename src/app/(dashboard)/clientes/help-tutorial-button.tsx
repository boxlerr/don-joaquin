"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  UserPlus,
  Upload,
  FileDown,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  MapPin,
} from "lucide-react";

type TabId = "manual" | "import" | "tips";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "manual", label: "Cargar manual", icon: <UserPlus size={14} /> },
  { id: "import", label: "Importar Excel", icon: <Upload size={14} /> },
  { id: "tips", label: "Filtros", icon: <Sparkles size={14} /> },
];

export default function HelpTutorialButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("manual");
  const [step, setStep] = useState(0);

  const steps =
    tab === "manual" ? MANUAL_STEPS : tab === "import" ? IMPORT_STEPS : TIPS_STEPS;
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
                  Guía de Gestión
                </Dialog.Title>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Tabs inside header */}
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
                  <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FEF3C7] text-[#92400E] shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles size={14} className="text-[#D97706]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309]">Pro Tip</span>
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
// Pasos: Cargar manual
// =============================================================================

const MANUAL_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Nuevo cliente"',
    description:
      'Arriba a la derecha del listado, hacé clic en el botón "Nuevo cliente". Se abre un modal centrado.',
    mockup: <MockToolbar highlight="new" />,
  },
  {
    title: "Completá los datos",
    description:
      "Razón social y Condición IVA son obligatorios. El resto (CUIT, domicilio, contacto) lo podés cargar ahora o después desde la ficha.",
    mockup: <MockNewClienteForm />,
    hint: "El CUIT no es obligatorio, pero si lo cargás es lo que después permite cruzar con AFIP y evitar duplicados.",
  },
  {
    title: "Guardar y listo",
    description:
      'Apretá "Guardar cliente". El modal se cierra solo y el cliente aparece en la cartera ordenado alfabéticamente.',
    mockup: <MockClienteCard razon="Don Joaquín SA" loc="Tres Arroyos" cuit="30-12345678-9" />,
  },
];

// =============================================================================
// Pasos: Importar Excel
// =============================================================================

const IMPORT_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Importar"',
    description:
      'En la misma fila del buscador, al lado de "Nuevo cliente", hay un botón "Importar". Hacé clic.',
    mockup: <MockToolbar highlight="import" />,
  },
  {
    title: "Descargá el template",
    description:
      'Dentro del modal, hacé clic en "Template" para bajar una planilla .xlsx con las columnas correctas y una fila de ejemplo.',
    mockup: <MockImportModal />,
    hint: 'Si te abre como bloc de notas, clic derecho sobre el archivo → "Abrir con" → Excel.',
  },
  {
    title: "Completá la planilla",
    description:
      "Una fila por cliente. La fila 1 es el encabezado, no la toques. Sólo razon_social es obligatorio.",
    mockup: <MockExcelSheet />,
    hint: (
      <>
        Para <b>condicion_iva</b> usá exactamente uno de:{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">
          responsable_inscripto
        </code>
        ,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">
          monotributo
        </code>
        ,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">
          exento
        </code>
        ,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">
          consumidor_final
        </code>
        ,{" "}
        <code className="text-[11px] bg-white border border-[#E2E8F0] px-1 rounded">
          no_categorizado
        </code>
        . Para <b>es_multinacional</b>: <code>sí</code> / <code>no</code>.
      </>
    ),
  },
  {
    title: "Subí el archivo",
    description:
      'Volvé al modal "Importar", elegí tu archivo, y apretá "Importar".',
    mockup: <MockFileUpload />,
  },
  {
    title: "Revisá el resultado",
    description:
      "Vas a ver cuántas filas se importaron y cuántas se omitieron. Si hay errores, aparecen detallados por número de fila para que las corrijas en el Excel y reintentes solo esas.",
    mockup: <MockImportResult />,
  },
];

// =============================================================================
// Pasos: Trucos
// =============================================================================

const TIPS_STEPS: TutorialStep[] = [
  {
    title: "Filtrá por inicial",
    description:
      'La fila de letras arriba del listado filtra por la primera letra de la razón social. "#" muestra todos.',
    mockup: <MockAlphabet active="D" />,
  },
  {
    title: "Mostrar inactivos",
    description:
      'Cambiá el selector de estado a "Inactivos" para ver los clientes dados de baja, o "Todos" para ver ambos.',
    mockup: <MockEstadoSelector />,
  },
  {
    title: "Dar de baja sin perder historial",
    description:
      'Cuando expandís un cliente, al final ves "Dar de baja". No borra al cliente: queda como inactivo y se conservan todos sus viajes y movimientos de cuenta corriente. Después podés "Reactivar" cuando quieras.',
    mockup: <MockDeleteReactivate />,
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
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-white border border-[#E2E8F0] rounded-md px-3 text-xs text-[#94A3B8] inline-flex items-center opacity-50">
        Buscar cliente por nombre…
      </div>
      <div className="h-9 px-3 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#475569] inline-flex items-center opacity-50">
        Activos
      </div>
      <div className="size-9 rounded-md border border-[#0088D1] bg-white text-[#0088D1] inline-flex items-center justify-center opacity-50">
        <HelpCircle size={14} />
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition-all " +
          (highlight === "import"
            ? "bg-white border-2 border-[#0088D1] text-[#0088D1] shadow-[0_0_0_4px_rgba(0,136,209,0.2)] scale-105"
            : "bg-white border border-[#E2E8F0] text-[#64748B] opacity-50")
        }
      >
        <Upload size={14} /> Importar
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition-all " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105"
            : "bg-[#0088D1] text-white opacity-50")
        }
      >
        <UserPlus size={14} /> Nuevo cliente
      </div>
    </div>
  );
}

function MockNewClienteForm() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] bg-white">
        <div className="text-[#0F172A] text-xs font-bold uppercase tracking-wider">Nuevo cliente</div>
      </div>
      <div className="p-4 space-y-4">
        <MockField
          label="Razón social *"
          value="Don Joaquín SA"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="CUIT" value="30-12345678-9" />
          <MockField label="Condición IVA *" value="Responsable inscripto" required />
        </div>
        <MockField label="Domicilio fiscal" value="Av. Siempre Viva 123" />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Localidad" value="Tres Arroyos" />
          <MockField label="Provincia" value="Buenos Aires" />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
          <div className="h-8 px-3 text-[11px] rounded-md border border-[#E2E8F0] text-[#64748B] inline-flex items-center hover:bg-[#F8FAFC]">
            Cancelar
          </div>
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-bold shadow-sm">
            Guardar cliente
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
      <div className="text-[10px] font-semibold text-[#475569] mb-0.5">
        {label}
      </div>
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

function MockClienteCard({
  razon,
  loc,
  cuit,
}: {
  razon: string;
  loc: string;
  cuit: string;
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[#E1F5FE] text-[#0088D1] font-bold text-sm flex items-center justify-center">
          D
        </span>
        <div>
          <div className="text-[#0F172A] font-semibold text-sm">{razon}</div>
          <div className="flex items-center gap-1 text-[10px] text-[#475569] uppercase tracking-wide mt-0.5">
            <MapPin size={10} className="text-[#0088D1]" />
            {loc}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[9px] font-semibold tracking-[0.18em] text-[#94A3B8] uppercase">
          Identificación
        </div>
        <div className="text-[#0F172A] text-xs font-mono">{cuit}</div>
      </div>
    </div>
  );
}

function MockImportModal() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md shadow-sm">
      <div className="px-3 py-2 border-b border-[#E2E8F0]">
        <div className="text-[#0F172A] text-xs font-semibold">Importar clientes</div>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5">
          <div className="text-[11px] text-[#475569]">
            ¿No tenés un template? Descargá el formato.
          </div>
          <div className="h-7 px-2 rounded-md border-2 border-[#0088D1] text-[#0088D1] text-[11px] font-semibold inline-flex items-center gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
            <FileDown size={11} /> Template
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#475569] mb-0.5">
            Archivo .xlsx / .csv
          </div>
          <div className="h-7 px-2 rounded border border-dashed border-[#E2E8F0] text-[11px] text-[#94A3B8] inline-flex items-center">
            Seleccionar archivo…
          </div>
        </div>
      </div>
    </div>
  );
}

function MockExcelSheet() {
  const headers = [
    "razon_social",
    "nombre_comercial",
    "cuit",
    "condicion_iva",
    "localidad",
    "provincia",
    "email",
    "es_multinacional",
  ];
  const example = [
    "Don Joaquín SA",
    "Don Joaquín",
    "30-12345678-9",
    "responsable_inscripto",
    "Tres Arroyos",
    "Buenos Aires",
    "ventas@dj.com",
    "no",
  ];
  const cols = "ABCDEFGH".split("");

  return (
    <div className="bg-white border border-[#94A3B8] rounded-sm overflow-hidden font-mono text-[10px]">
      <div className="grid grid-cols-[24px_repeat(8,minmax(0,1fr))] bg-[#E2E8F0] text-[#475569] font-semibold border-b border-[#94A3B8]">
        <div className="border-r border-[#94A3B8] text-center py-0.5"></div>
        {cols.map((c) => (
          <div key={c} className="border-r border-[#94A3B8] text-center py-0.5">
            {c}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[24px_repeat(8,minmax(0,1fr))] bg-[#FFFBEB] text-[#0F172A] font-semibold border-b border-[#E2E8F0]">
        <div className="border-r border-[#94A3B8] bg-[#E2E8F0] text-[#475569] text-center py-1">
          1
        </div>
        {headers.map((h) => (
          <div
            key={h}
            className="border-r border-[#E2E8F0] truncate px-1 py-1"
            title={h}
          >
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[24px_repeat(8,minmax(0,1fr))] text-[#0F172A] border-b border-[#E2E8F0]">
        <div className="border-r border-[#94A3B8] bg-[#E2E8F0] text-[#475569] text-center py-1 font-semibold">
          2
        </div>
        {example.map((v, i) => (
          <div
            key={i}
            className="border-r border-[#E2E8F0] truncate px-1 py-1"
            title={v}
          >
            {v}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[24px_repeat(8,minmax(0,1fr))] text-[#94A3B8]">
        <div className="border-r border-[#94A3B8] bg-[#E2E8F0] text-[#475569] text-center py-1 font-semibold">
          3
        </div>
        {cols.map((_, i) => (
          <div
            key={i}
            className="border-r border-[#E2E8F0] px-1 py-1 italic"
          >
            …
          </div>
        ))}
      </div>
    </div>
  );
}

function MockFileUpload() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md shadow-sm">
      <div className="px-3 py-2 border-b border-[#E2E8F0] text-[#0F172A] text-xs font-semibold">
        Importar clientes
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2">
          <Upload size={14} className="text-[#0088D1]" />
          <div className="flex-1 text-[11px] text-[#0F172A] font-mono">
            mis-clientes.xlsx
          </div>
          <div className="text-[10px] text-[#475569]">Listo para importar</div>
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-7 px-2 text-[11px] rounded-md border border-[#E2E8F0] text-[#475569] inline-flex items-center">
            Cancelar
          </div>
          <div className="h-7 px-2 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold gap-1">
            <Upload size={11} /> Importar
          </div>
        </div>
      </div>
    </div>
  );
}

function MockImportResult() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md p-3 space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-[#065F46] font-semibold">Importados: 8</span>
        <span className="text-[#92400E] font-semibold">Omitidos: 2</span>
      </div>
      <div className="border-t border-[#E2E8F0] pt-2 text-[11px] space-y-1 text-[#7F1D1D] font-mono">
        <div>
          <span className="font-semibold">Fila 5:</span> Falta razón social.
        </div>
        <div>
          <span className="font-semibold">Fila 9:</span> Email inválido: ana@@dj
        </div>
      </div>
    </div>
  );
}

function MockAlphabet({ active }: { active: string }) {
  const letters = ["#", ..."ABCDEFGH".split("")];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {letters.map((l) => (
        <span
          key={l}
          className={
            "size-7 rounded-full text-[11px] font-semibold inline-flex items-center justify-center border " +
            (l === active
              ? "bg-[#0F172A] text-white border-[#0F172A]"
              : "bg-white text-[#475569] border-[#E2E8F0]")
          }
        >
          {l}
        </span>
      ))}
      <span className="text-[10px] text-[#475569] ml-2">… resto del abecedario</span>
    </div>
  );
}

function MockEstadoSelector() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-white border border-[#E2E8F0] rounded-md px-3 text-xs text-[#94A3B8] inline-flex items-center">
        Buscar cliente por nombre…
      </div>
      <div className="h-9 px-3 bg-white border-2 border-[#0088D1] rounded-md text-xs text-[#0088D1] font-semibold inline-flex items-center gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
        Inactivos ▾
      </div>
    </div>
  );
}

function MockDeleteReactivate() {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 flex items-center justify-between">
        <div className="text-xs text-[#0F172A]">
          <b>Don Joaquín SA</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] rounded-full px-2 py-0.5">
            Activo
          </span>
        </div>
        <div className="h-7 px-2 text-[11px] rounded-md border border-[#FECACA] text-[#B91C1C] inline-flex items-center gap-1 font-semibold">
          Dar de baja
        </div>
      </div>
      <div className="text-center text-[11px] text-[#475569]">↓ luego</div>
      <div className="bg-white border border-[#E2E8F0] rounded-md p-2 flex items-center justify-between opacity-70">
        <div className="text-xs text-[#0F172A]">
          <b>Don Joaquín SA</b>{" "}
          <span className="ml-2 text-[10px] uppercase tracking-wide bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] rounded-full px-2 py-0.5">
            Inactivo
          </span>
        </div>
        <div className="h-7 px-2 text-[11px] rounded-md border border-[#A7F3D0] text-[#065F46] inline-flex items-center gap-1 font-semibold">
          Reactivar
        </div>
      </div>
    </div>
  );
}
