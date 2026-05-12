"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  HelpCircle,
  X,
  Plus,
  Search,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Pencil,
  PauseCircle,
  Clock,
} from "lucide-react";

type TabId = "crear" | "busqueda" | "auditoria";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "crear", label: "Crear / Editar", icon: <Plus size={14} /> },
  { id: "busqueda", label: "Búsqueda y Filtros", icon: <Search size={14} /> },
  { id: "auditoria", label: "Editar y Auditoría", icon: <History size={14} /> },
];

export default function HelpTutorialButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("crear");
  const [step, setStep] = useState(0);

  const steps =
    tab === "crear" ? MANUAL_STEPS : tab === "busqueda" ? SEARCH_STEPS : AUDIT_STEPS;
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
          setTab("crear");
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
                  Cómo gestionar tarifas
                </Dialog.Title>
                <Dialog.Description className="text-[#475569] text-xs mt-0.5">
                  Paso a paso visual para crear y administrar tarifas por cliente.
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
// Tipo
// =============================================================================

type TutorialStep = {
  title: string;
  description: React.ReactNode;
  mockup: React.ReactNode;
  hint?: React.ReactNode;
};

// =============================================================================
// Pasos: Crear / Editar
// =============================================================================

const MANUAL_STEPS: TutorialStep[] = [
  {
    title: 'Abrí "Nueva tarifa"',
    description:
      'Arriba a la derecha del panel, hacé clic en "Nueva tarifa". Se abre un modal centrado.',
    mockup: <MockToolbarTarifas highlight="new" />,
  },
  {
    title: "Elegí un cliente",
    description:
      "Dropdown con clientes activos. Al seleccionar, se cargan sus rutas automáticamente.",
    mockup: <MockClienteDropdown />,
    hint: "Si el cliente tiene varias rutas, cada una puede tener tarifa diferente.",
  },
  {
    title: "Elegí la ruta",
    description:
      "La lista de rutas se carga según el cliente. Selecciona la que querés tarifar.",
    mockup: <MockRutaDropdown />,
    hint: "Las rutas vienen de la BD. Si no aparece la que buscas, podés crearla antes en puntos_ruta.",
  },
  {
    title: "Elegí cómo se cobra",
    description:
      "Modalidad: fija (precio único), por kilo, por tonelada, por km.",
    mockup: <MockModalidadSelect />,
    hint: "Fija = mismo precio siempre. Por tonelada = precio × peso. Por km = precio × distancia.",
  },
  {
    title: "Colocá el precio unitario",
    description:
      "Según la modalidad elegida, ingresá el valor. Ej: si es 'por_kg', ingresá $ por kg.",
    mockup: <MockPrecioInput />,
    hint: "El campo dice automáticamente qué unidad de medida corresponde. Siempre ≥ $0.",
  },
  {
    title: "Tarifa base (opcional)",
    description:
      "Suma fija que se agrega a cualquier modalidad. Ej: $500 base + $2 por km.",
    mockup: <MockBaseInput />,
    hint: "Si dejás en blanco = $0. Útil para fletes que tienen componente fija + variable.",
  },
  {
    title: "Cuándo es válida",
    description:
      "Fecha inicio (hoy) y fin (opcional). Si no ponés fin = vigente indefinidamente.",
    mockup: <MockVigenciaInputs />,
    hint: "Importante: fecha_fin > fecha_inicio. Si querés retirar una tarifa, cambiala a inactiva.",
  },
  {
    title: "Guardar",
    description:
      "Apretá 'Guardar tarifa'. Se audita el cambio y aparece en la tabla.",
    mockup: <MockGuardarButton />,
    hint: "Todos los cambios quedan registrados en el historial. Podés ver quién cambió qué y cuándo.",
  },
];

// =============================================================================
// Pasos: Búsqueda y Filtros
// =============================================================================

const SEARCH_STEPS: TutorialStep[] = [
  {
    title: "Buscá cliente o ruta",
    description:
      "La barra de búsqueda filtra por razón social del cliente o nombre de ruta.",
    mockup: <MockSearchBar />,
    hint: "Busca en tiempo real. Sirve para encontrar rápido entre 100+ tarifas.",
  },
  {
    title: "Filtrá por modalidad",
    description:
      "Dropdown de modalidad: Todas, Fija, Por tonelada, Por kilo, Por kilómetro.",
    mockup: <MockModalidadFiltro />,
    hint: "Combiná con la búsqueda de texto para llegar directo a lo que necesitás.",
  },
  {
    title: "Filtrá solo activas",
    description:
      "Checkbox 'Solo activas' para esconder las tarifas pausadas. Útil en carteras grandes.",
    mockup: <MockSoloActivas />,
    hint: "Las inactivas no se usan en cálculos, pero quedan guardadas para auditoría.",
  },
  {
    title: "Resultados en tabla",
    description:
      "Lista de tarifas filtradas agrupadas por cliente. Columnas: Ruta | Modalidad | Valor | Vigencia | Estado | Acciones.",
    mockup: <MockTarifaTable highlight="none" />,
    hint: "En acciones ves: editar (lápiz), cambiar estado (pausa/check), y ver historial (reloj).",
  },
];

// =============================================================================
// Pasos: Editar y Auditoría
// =============================================================================

const AUDIT_STEPS: TutorialStep[] = [
  {
    title: "Editá una tarifa",
    description:
      "En la fila de la tarifa, hacé clic en el ícono lápiz. Se abre el mismo modal de creación pre-llenado.",
    mockup: <MockTarifaTable highlight="edit" />,
    hint: "Podés cambiar modalidad, precio, fechas. El cambio se audita automáticamente.",
  },
  {
    title: "Activá o desactivá",
    description:
      "Botón pausa/check para cambiar de 'activa' a 'inactiva'. No borra datos.",
    mockup: <MockTarifaTable highlight="status" />,
    hint: "Inactiva = no se usa en cálculos pero queda en BD. Perfecta para pausar una tarifa.",
  },
  {
    title: "Historial y quién editó",
    description:
      "Ícono reloj abre un drawer mostrando todas las versiones anteriores: quién cambió, cuándo, y qué cambió.",
    mockup: <MockHistorialDrawer />,
    hint: "Si necesitás volver atrás, hay un botón 'Revertir' en cada evento antiguo.",
  },
  {
    title: "Deshacé cambios (revert)",
    description:
      "En el historial, hacé clic en un evento anterior y apretá 'Revertir'. Vuelven los valores viejos.",
    mockup: <MockRevertEvent />,
    hint: "Se registra como nuevo cambio. No borra el evento original.",
  },
];

// =============================================================================
// Mocks
// =============================================================================

function MockToolbarTarifas({ highlight }: { highlight: "new" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-white border border-[#E2E8F0] rounded-md px-3 text-xs text-[#94A3B8] inline-flex items-center">
        Buscar por cliente, ruta, observaciones…
      </div>
      <div className="h-9 px-3 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#475569] inline-flex items-center">
        Todas las modalidades ▾
      </div>
      <div className="size-9 rounded-md border border-[#E2E8F0] bg-white text-[#0088D1] inline-flex items-center justify-center">
        <HelpCircle size={14} />
      </div>
      <div
        className={
          "h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 " +
          (highlight === "new"
            ? "bg-[#0088D1] text-white shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-2 ring-[#0088D1]"
            : "bg-[#0088D1] text-white")
        }
      >
        <Plus size={12} /> Nueva tarifa
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

function MockClienteDropdown() {
  return (
    <div className="space-y-2 max-w-[380px] mx-auto">
      <MockField label="Cliente *" value="Don Joaquín SA" required />
      <div className="text-[10px] text-[#94A3B8] pl-0.5">
        ↓ Al seleccionar el cliente, se cargan sus rutas
      </div>
      <div className="h-7 px-2 text-[11px] rounded border border-[#E2E8F0] bg-[#F1F5F9] text-[#94A3B8] inline-flex items-center w-full">
        Ruta (cargando…)
      </div>
    </div>
  );
}

function MockRutaDropdown() {
  return (
    <div className="space-y-2 max-w-[380px] mx-auto">
      <MockField label="Cliente *" value="Don Joaquín SA" required />
      <div>
        <div className="text-[10px] font-semibold text-[#475569] mb-0.5">Ruta</div>
        <div className="border border-[#0088D1]/60 rounded bg-white text-[11px] overflow-hidden">
          <div className="px-2 py-1.5 bg-[#E1F5FE] text-[#0088D1] font-semibold flex items-center gap-1">
            Ruta CABA – Tres Arroyos
          </div>
          <div className="px-2 py-1.5 text-[#475569] border-t border-[#E2E8F0]">Ruta Rosario – Córdoba</div>
          <div className="px-2 py-1.5 text-[#475569] border-t border-[#E2E8F0]">Sin ruta específica</div>
        </div>
      </div>
    </div>
  );
}

function MockModalidadSelect() {
  const opciones = [
    { value: "fija", label: "Fija", desc: "Precio único sin importar distancia o peso" },
    { value: "por_kilo", label: "Por kilo", desc: "$ por kg", active: true },
    { value: "por_tonelada", label: "Por tonelada", desc: "$ por tonelada" },
    { value: "por_km", label: "Por kilómetro", desc: "$ por km recorrido" },
  ];
  return (
    <div className="space-y-1.5 max-w-[380px] mx-auto">
      <div className="text-[10px] font-semibold text-[#475569] mb-1">Modalidad *</div>
      {opciones.map((o) => (
        <div
          key={o.value}
          className={
            "flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] cursor-pointer " +
            (o.active
              ? "border-[#0088D1] bg-[#E1F5FE] text-[#0088D1]"
              : "border-[#E2E8F0] bg-white text-[#475569]")
          }
        >
          <span
            className={
              "size-3.5 rounded-full border-2 inline-flex items-center justify-center shrink-0 " +
              (o.active ? "border-[#0088D1]" : "border-[#CBD5E1]")
            }
          >
            {o.active && <span className="size-1.5 rounded-full bg-[#0088D1]" />}
          </span>
          <span className="font-semibold">{o.label}</span>
          <span className="text-[#94A3B8] ml-auto">{o.desc}</span>
        </div>
      ))}
    </div>
  );
}

function MockPrecioInput() {
  return (
    <div className="space-y-2 max-w-[380px] mx-auto">
      <div>
        <div className="text-[10px] font-semibold text-[#475569] mb-0.5">
          Precio unitario ($ / kg) *
        </div>
        <div className="flex items-center gap-1">
          <div className="h-7 px-2 text-[11px] rounded-l border border-r-0 border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] inline-flex items-center">
            $
          </div>
          <div className="h-7 px-2 text-[11px] rounded-r border border-[#0088D1]/60 bg-white text-[#0F172A] font-mono inline-flex items-center flex-1">
            2.50
          </div>
        </div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5">Precio por kilogramo transportado</div>
      </div>
    </div>
  );
}

function MockBaseInput() {
  return (
    <div className="space-y-2 max-w-[380px] mx-auto">
      <MockField label="Precio unitario ($ / kg) *" value="$ 2.50" />
      <div>
        <div className="text-[10px] font-semibold text-[#475569] mb-0.5">
          Suma base ($ — opcional)
        </div>
        <div className="flex items-center gap-1">
          <div className="h-7 px-2 text-[11px] rounded-l border border-r-0 border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] inline-flex items-center">
            $
          </div>
          <div className="h-7 px-2 text-[11px] rounded-r border border-[#E2E8F0] bg-white text-[#94A3B8] italic inline-flex items-center flex-1">
            0.00
          </div>
        </div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5">
          Se suma fija a cualquier cálculo. Ej: $500 base + $2.50/kg
        </div>
      </div>
    </div>
  );
}

function MockVigenciaInputs() {
  return (
    <div className="space-y-2 max-w-[380px] mx-auto">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-semibold text-[#475569] mb-0.5">Vigente desde *</div>
          <div className="h-7 px-2 text-[11px] rounded border border-[#0088D1]/60 bg-white text-[#0F172A] inline-flex items-center w-full">
            11/05/2026
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-[#475569] mb-0.5">Vigente hasta</div>
          <div className="h-7 px-2 text-[11px] rounded border border-[#E2E8F0] bg-white text-[#94A3B8] italic inline-flex items-center w-full">
            Sin vencimiento
          </div>
        </div>
      </div>
      <div className="text-[10px] text-[#94A3B8]">
        Si no ponés fecha fin, la tarifa queda vigente indefinidamente.
      </div>
    </div>
  );
}

function MockGuardarButton() {
  return (
    <div className="max-w-[380px] mx-auto bg-white border border-[#E2E8F0] rounded-md shadow-sm">
      <div className="px-3 py-2 border-b border-[#E2E8F0]">
        <div className="text-[#0F172A] text-xs font-semibold">Nueva tarifa</div>
      </div>
      <div className="p-3 space-y-1.5">
        <MockField label="Cliente" value="Don Joaquín SA" />
        <MockField label="Ruta" value="CABA – Tres Arroyos" />
        <MockField label="Modalidad" value="Por kilo" />
        <MockField label="Precio / kg" value="$ 2.50" />
        <div className="flex justify-end gap-2 pt-1">
          <div className="h-7 px-2 text-[11px] rounded-md border border-[#E2E8F0] text-[#475569] inline-flex items-center">
            Cancelar
          </div>
          <div className="h-7 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center font-semibold shadow-[0_0_0_3px_rgba(0,136,209,0.25)] ring-1 ring-[#0088D1]">
            Guardar tarifa
          </div>
        </div>
      </div>
    </div>
  );
}

function MockSearchBar() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
        />
        <div className="h-9 pl-7 pr-3 bg-white border-2 border-[#0088D1] rounded-md text-xs text-[#0F172A] inline-flex items-center w-full shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
          don joaquin
        </div>
      </div>
      <div className="h-9 px-3 bg-white border border-[#E2E8F0] rounded-md text-xs text-[#475569] inline-flex items-center">
        Todas las modalidades ▾
      </div>
    </div>
  );
}

function MockModalidadFiltro() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-9 bg-white border border-[#E2E8F0] rounded-md px-3 text-xs text-[#94A3B8] inline-flex items-center">
        Buscar por cliente, ruta…
      </div>
      <div className="h-9 px-3 bg-white border-2 border-[#0088D1] rounded-md text-xs text-[#0088D1] font-semibold inline-flex items-center gap-1 shadow-[0_0_0_3px_rgba(0,136,209,0.15)]">
        Por tonelada ▾
      </div>
    </div>
  );
}

function MockSoloActivas() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-9 bg-white border border-[#E2E8F0] rounded-md px-3 text-xs text-[#94A3B8] inline-flex items-center">
        Buscar por cliente, ruta…
      </div>
      <label className="flex items-center gap-2 text-xs text-[#0088D1] font-semibold cursor-pointer select-none bg-[#E1F5FE] px-2.5 h-9 rounded-md border border-[#0088D1]/40">
        <span className="size-4 rounded border-2 border-[#0088D1] bg-[#0088D1] inline-flex items-center justify-center">
          <CheckCircle2 size={10} className="text-white" />
        </span>
        Solo activas
      </label>
    </div>
  );
}

function MockTarifaTable({ highlight }: { highlight: "edit" | "status" | "history" | "none" }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-semibold uppercase tracking-widest text-[#475569] flex gap-4">
        <span className="flex-1">Ruta</span>
        <span className="w-20">Modalidad</span>
        <span className="w-16 text-right">Valor</span>
        <span className="w-16">Estado</span>
        <span className="w-20 text-right">Acciones</span>
      </div>
      <div className="px-3 py-2.5 flex items-center gap-4 text-[11px]">
        <span className="flex-1 text-[#0F172A]">CABA – Tres Arroyos</span>
        <span className="w-20">
          <span className="px-1.5 py-0.5 rounded bg-[#E1F5FE] text-[#004A99] font-medium">Por kilo</span>
        </span>
        <span className="w-16 text-right font-mono text-[#0F172A] font-semibold">$ 2.50</span>
        <span className="w-16 text-[#10B981] font-medium flex items-center gap-1">
          <CheckCircle2 size={10} /> Activa
        </span>
        <div className="w-20 flex items-center justify-end gap-1">
          <span
            className={
              "size-6 rounded inline-flex items-center justify-center " +
              (highlight === "edit"
                ? "bg-[#0088D1] text-white ring-2 ring-[#0088D1] shadow-[0_0_0_3px_rgba(0,136,209,0.25)]"
                : "text-[#94A3B8] hover:text-[#0088D1]")
            }
          >
            <Pencil size={11} />
          </span>
          <span
            className={
              "size-6 rounded inline-flex items-center justify-center " +
              (highlight === "status"
                ? "bg-[#FFF7E6] text-[#FFB300] ring-2 ring-[#FFB300] shadow-[0_0_0_3px_rgba(255,179,0,0.2)]"
                : "text-[#94A3B8]")
            }
          >
            <PauseCircle size={11} />
          </span>
          <span
            className={
              "size-6 rounded inline-flex items-center justify-center " +
              (highlight === "history"
                ? "bg-[#E1F5FE] text-[#0088D1] ring-2 ring-[#0088D1] shadow-[0_0_0_3px_rgba(0,136,209,0.25)]"
                : "text-[#94A3B8]")
            }
          >
            <Clock size={11} />
          </span>
        </div>
      </div>
    </div>
  );
}

function MockHistorialDrawer() {
  const events = [
    { user: "Lucas G.", date: "11/05/2026", prev: "$ 2.00 / kg", next: "$ 2.50 / kg", current: true },
    { user: "María R.", date: "01/03/2026", prev: "$ 1.80 / kg", next: "$ 2.00 / kg", current: false },
    { user: "Lucas G.", date: "10/01/2026", prev: "—", next: "$ 1.80 / kg", current: false },
  ];
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md overflow-hidden max-w-[380px] mx-auto">
      <div className="px-3 py-2 border-b border-[#E2E8F0] flex items-center gap-2">
        <Clock size={13} className="text-[#0088D1]" />
        <div className="text-[#0F172A] text-xs font-semibold">Historial de cambios</div>
      </div>
      <div className="divide-y divide-[#E2E8F0]">
        {events.map((e, i) => (
          <div key={i} className={`px-3 py-2 text-[11px] ${e.current ? "bg-[#F0F9FF]" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#0F172A]">{e.user}</span>
              <span className="text-[#94A3B8]">{e.date}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[#475569]">
              <span className="line-through text-[#94A3B8]">{e.prev}</span>
              <span>→</span>
              <span className="text-[#0F172A] font-medium">{e.next}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockRevertEvent() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-md overflow-hidden max-w-[380px] mx-auto">
      <div className="px-3 py-2 border-b border-[#E2E8F0] flex items-center gap-2">
        <Clock size={13} className="text-[#0088D1]" />
        <div className="text-[#0F172A] text-xs font-semibold">Historial de cambios</div>
      </div>
      <div className="px-3 py-2 bg-[#F0F9FF] border-b border-[#E2E8F0] text-[11px]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#0F172A]">Lucas G.</span>
          <span className="text-[#94A3B8]">11/05/2026</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[#475569]">
          <span className="line-through text-[#94A3B8]">$ 2.00 / kg</span>
          <span>→</span>
          <span className="text-[#0F172A] font-medium">$ 2.50 / kg</span>
        </div>
      </div>
      <div className="px-3 py-2 text-[11px] border-b border-[#E2E8F0] bg-[#FFFBEB]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#0F172A]">María R.</span>
          <span className="text-[#94A3B8]">01/03/2026</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[#475569]">
          <span className="line-through text-[#94A3B8]">$ 1.80 / kg</span>
          <span>→</span>
          <span className="text-[#0F172A] font-medium">$ 2.00 / kg</span>
        </div>
        <div className="mt-1.5">
          <span className="px-2 py-0.5 rounded border border-[#FBBF24] text-[#92400E] bg-[#FFFBEB] font-semibold text-[10px] cursor-pointer hover:bg-[#FEF3C7]">
            Revertir a $ 2.00 / kg
          </span>
        </div>
      </div>
      <div className="px-3 py-2 text-[11px] text-[#475569]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#0F172A]">Lucas G.</span>
          <span className="text-[#94A3B8]">10/01/2026</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[#94A3B8]">—</span>
          <span>→</span>
          <span className="text-[#0F172A] font-medium">$ 1.80 / kg</span>
        </div>
        <div className="mt-1.5">
          <span className="px-2 py-0.5 rounded border border-[#FBBF24] text-[#92400E] bg-[#FFFBEB] font-semibold text-[10px] cursor-pointer hover:bg-[#FEF3C7]">
            Revertir a $ 1.80 / kg
          </span>
        </div>
      </div>
    </div>
  );
}
