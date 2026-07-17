"use client";

import HelpTutorialDialog, { MockField, type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  HelpCircle,
  Plus,
  Eye,
  Paperclip,
  Banknote,
  AlertTriangle,
  Truck,
  User,
  ShieldCheck,
  FileText,
  Tag,
  Activity,
  CheckCircle2,
  Search,
  Edit,
  Trash2,
  ChevronDown,
  DollarSign,
  Calendar,
  CreditCard,
  Download,
  ZoomIn,
  Film,
  Image as ImageIcon,
} from "lucide-react";

// ===========================================================================
// Helpers de mockup (todo a nivel de módulo)
// ===========================================================================

function TipoChip({ label = "Choque", tone = "red" }: { label?: string; tone?: "red" | "blue" | "green" }) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
  } as const;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${tones[tone]}`}>
      {label}
    </span>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ComboRow({ text, warn, muted }: { text: string; warn?: boolean; muted?: boolean }) {
  return (
    <div
      className={
        "flex items-center gap-1.5 px-2 py-1.5 text-[11px] " +
        (muted ? "text-muted-foreground/60 bg-muted/40" : "text-foreground")
      }
    >
      {warn && <span className="text-amber-500">⚠</span>}
      <User size={11} className={muted ? "text-muted-foreground/50" : "text-primary"} />
      <span className="truncate">{text}</span>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Registrar
// ===========================================================================

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <div className="text-foreground text-sm font-bold">Siniestros</div>
        <div className="text-[10px] text-muted-foreground/70">Historial y registro de la flota</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 px-2.5 rounded-md border border-border bg-card text-primary inline-flex items-center gap-1.5 text-[11px] font-medium opacity-70">
          <HelpCircle size={14} /> Tutorial
        </div>
        <div className="h-px w-4 bg-border rotate-90" />
        <div className="h-9 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
          <Plus size={12} /> Registrar Siniestro
        </div>
      </div>
    </div>
  );
}

function MockNewSiniestroForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#FEE2E2] text-[#EF4444] inline-flex items-center justify-center">
          <AlertTriangle size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Registrar siniestro</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Camión *" value="AB123CD" icon={<Truck size={11} />} required />
          <MockField label="Chofer" value="Juan Pérez" icon={<User size={11} />} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha *" value="10/05/2026" icon={<Calendar size={11} />} required />
          <MockField label="Monto daños" value="$ 250.000" icon={<DollarSign size={11} />} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Tipo *" value="Choque" icon={<Tag size={11} />} required />
          <MockField label="Estado *" value="Abierto" icon={<Activity size={11} />} required />
        </div>
        <MockField label="Descripción *" value="Roce lateral en maniobra…" icon={<FileText size={11} />} required />
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <div className="h-8 px-3 text-[11px] rounded-md border border-border text-muted-foreground inline-flex items-center">
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

function MockChoferSelect() {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground">Chofer involucrado (opcional)</div>
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/40">
          <span className="text-[11px] text-foreground inline-flex items-center gap-1.5">
            <User size={11} className="text-primary" /> Elegí un chofer…
          </span>
          <ChevronDown size={13} className="text-muted-foreground" />
        </div>
        <div className="divide-y divide-border">
          <ComboRow text="Sin chofer / Otro" />
          <ComboRow text="Juan Pérez" />
          <ComboRow text="Marcos Díaz — legajo incompleto" warn muted />
        </div>
      </div>
      <div className="rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-800 px-2.5 py-1.5 flex items-center gap-1.5">
        <AlertTriangle size={12} className="text-amber-600 shrink-0" />
        Los choferes con legajo incompleto salen con ⚠ y no se pueden elegir.
      </div>
    </div>
  );
}

function MockSiniestroListItem() {
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-[8px] p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-9 rounded-full bg-[#FEE2E2] text-[#EF4444] inline-flex items-center justify-center border border-[#FECACA]">
            <AlertTriangle size={16} />
          </span>
          <div>
            <div className="text-foreground font-semibold text-sm flex items-center gap-1.5">
              AB123CD
              <TipoChip label="Choque" tone="red" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">10/05/2026 — Juan Pérez</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <TipoChip label="Abierto" tone="green" />
          <span className="text-[11px] font-bold text-red-600">$ 250.000</span>
        </div>
      </div>
      <div className="text-[10px] text-[#10B981] bg-[#ECFDF5] border border-[#A7F3D0] rounded px-2 py-1 inline-flex items-center gap-1 font-semibold">
        <CheckCircle2 size={11} /> Siniestro registrado correctamente
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Ver y gestionar
// ===========================================================================

function MockSearch() {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Total" value="12" color="text-foreground" />
        <KpiCard label="Costo daños" value="$ 1.8M" color="text-red-600" />
        <KpiCard label="Este mes" value="3" color="text-amber-600" />
        <KpiCard label="Camiones" value="5" color="text-emerald-600" />
      </div>
      <div className="h-9 px-2 rounded-md border-2 border-[#0088D1] bg-card text-[11px] text-muted-foreground inline-flex items-center gap-2 w-full shadow-[0_0_0_4px_rgba(0,136,209,0.2)]">
        <Search size={13} className="text-primary" />
        <span className="text-muted-foreground/70">Buscar patente, chofer, tipo, estado…</span>
      </div>
    </div>
  );
}

function MockRowExpand() {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 grid grid-cols-[1fr,64px,60px,20px] gap-2 items-center bg-muted/40 ring-2 ring-[#0088D1]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-primary">AB123CD</span>
          <span className="text-[10px] text-muted-foreground">Juan Pérez</span>
        </div>
        <TipoChip label="Choque" tone="red" />
        <TipoChip label="Abierto" tone="green" />
        <ChevronDown size={14} className="text-muted-foreground justify-self-end" />
      </div>
      <div className="grid grid-cols-3 gap-2 p-2.5 bg-muted/40">
        <div className="rounded border border-border bg-card p-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-1">
            <Truck size={10} className="text-primary" /> Unidad
          </div>
          <div className="text-[10px] text-foreground">Scania V200</div>
        </div>
        <div className="rounded border border-border bg-card p-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-1">
            <ShieldCheck size={10} className="text-[#10B981]" /> Seguro
          </div>
          <div className="text-[10px] text-foreground">La Caja</div>
        </div>
        <div className="rounded border border-border bg-card p-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-1">
            <FileText size={10} className="text-[#F59E0B]" /> Detalle
          </div>
          <div className="text-[10px] text-muted-foreground line-clamp-2">Roce lateral en maniobra…</div>
        </div>
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-primary text-center font-semibold">
        Clic en la fila para desplegar / ocultar el detalle
      </div>
    </div>
  );
}

function MockEditDelete() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-3">
      <div className="text-[10px] text-muted-foreground">Fila del siniestro</div>
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border">
        <div className="h-7 px-2.5 text-[11px] rounded-md text-primary bg-blue-50 inline-flex items-center gap-1.5 font-bold">
          <Edit size={11} /> Editar
        </div>
        <div className="h-7 px-2.5 text-[11px] rounded-md bg-red-50 text-red-600 border border-red-100 inline-flex items-center gap-1.5 font-bold">
          <Trash2 size={11} /> Eliminar
        </div>
      </div>
      <div className="rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700 p-2 flex items-center gap-2">
        <span className="font-bold">¿Confirmar?</span>
        <span className="h-6 px-2 rounded bg-red-600 text-white text-[10px] font-bold inline-flex items-center">Sí, borrar</span>
        <span className="h-6 px-2 rounded border border-border text-[10px] inline-flex items-center">No</span>
      </div>
      <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] text-[#075985] p-2 flex items-center gap-1.5">
        <Activity size={12} />
        Editá para pasar el estado a <b>En gestión</b> o <b>Cerrado</b>.
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3 — Fotos y archivos
// ===========================================================================

function MockAdjuntarBtn() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5">
          <Paperclip size={12} className="text-primary" /> Archivos adjuntos
          <span className="text-muted-foreground/60 font-bold">(0)</span>
        </span>
        <span className="h-7 px-2 text-[11px] rounded-md text-primary bg-blue-50 inline-flex items-center gap-1 font-bold">
          <Plus size={12} /> Adjuntar
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/70">Sin archivos adjuntos</p>
      <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-1.5">
        El panel está abajo de todo, dentro del detalle desplegado del siniestro.
      </div>
    </div>
  );
}

function MockAdjuntarForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-foreground text-xs font-bold">Adjuntar archivos</div>
        <div className="text-[10px] text-muted-foreground/70">Fotos, parte policial, informe, video… varios a la vez.</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="rounded-lg border-2 border-dashed border-[#0088D1]/40 bg-[#0088D1]/5 px-3 py-4 flex flex-col items-center gap-1 text-primary">
          <Paperclip size={16} />
          <span className="text-[11px] font-semibold">Elegí archivos o soltalos acá</span>
          <span className="text-[9px] text-muted-foreground/70">fotos, parte, informe, video — hasta 20 MB c/u</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
            <ImageIcon size={12} className="text-primary" />
            <span className="text-[10px] text-foreground truncate flex-1">frente-camion.jpg</span>
            <span className="text-[9px] text-muted-foreground/70">1.2 MB</span>
          </div>
          <div className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
            <Film size={12} className="text-primary" />
            <span className="text-[10px] text-foreground truncate flex-1">video-choque.mp4</span>
            <span className="text-[9px] text-muted-foreground/70">14 MB</span>
          </div>
        </div>
        <MockField label="Descripción (opcional)" value="Fotos del frente + parte" icon={<FileText size={11} />} />
        <div className="flex justify-end pt-1">
          <div className="h-8 px-3 text-[11px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <Plus size={11} /> Adjuntar
          </div>
        </div>
      </div>
    </div>
  );
}

function MockGaleria() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-3">
      <div>
        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1.5">Fotos (3)</div>
        <div className="grid grid-cols-3 gap-2">
          {["from-sky-100 to-sky-200", "from-amber-100 to-amber-200", "from-rose-100 to-rose-200"].map((g, i) => (
            <div key={i} className={`relative aspect-square rounded-lg border border-border bg-gradient-to-br ${g} flex items-center justify-center`}>
              <ImageIcon size={16} className="text-foreground/40" />
              {i === 0 && (
                <span className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center">
                  <ZoomIn size={14} className="text-white" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1.5">Documentos (1)</div>
        <div className="flex items-center gap-2 text-[11px]">
          <FileText size={13} className="text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate flex-1">parte-policial.pdf</span>
          <span className="text-[9px] text-muted-foreground/70">320 KB</span>
          <Download size={12} className="text-muted-foreground/70" />
          <Trash2 size={12} className="text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 4 — Pago en caja
// ===========================================================================

function MockPagoBtn() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2 text-xs">
      <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1.5 border-b border-border pb-2">
        <ShieldCheck size={12} className="text-[#10B981]" /> Seguro y daños
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Daños estimados:</span>
        <span className="font-black text-red-600">$ 250.000</span>
      </div>
      <div className="h-8 rounded-md border border-green-200 bg-green-50 text-green-700 inline-flex items-center justify-center gap-1.5 font-bold text-[11px] w-full">
        <Banknote size={13} /> Registrar pago en caja
      </div>
    </div>
  );
}

function MockPagoForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="size-7 rounded-full bg-green-50 text-green-600 inline-flex items-center justify-center">
          <Banknote size={14} />
        </span>
        <div className="text-foreground text-xs font-bold">Registrar pago de siniestro</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Monto *" value="$ 250.000" icon={<DollarSign size={11} />} required />
          <MockField label="Fecha *" value="12/05/2026" icon={<Calendar size={11} />} required />
        </div>
        <MockField label="Medio de pago *" value="Transferencia" icon={<CreditCard size={11} />} required />
        <MockField label="Observaciones" value="Pago parcial, resto lo cubre el seguro" />
        <div className="flex justify-end pt-1">
          <div className="h-8 px-3 text-[11px] rounded-md bg-green-600 text-white inline-flex items-center gap-1 font-bold">
            <CheckCircle2 size={11} /> Registrar egreso
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPagoResultado() {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Movimientos de caja</div>
      <div className="bg-card border border-border rounded-[8px] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-full bg-red-50 text-red-600 inline-flex items-center justify-center">
            <Banknote size={14} />
          </span>
          <div>
            <div className="text-[11px] font-semibold text-foreground">Siniestro Choque - AB123CD</div>
            <div className="text-[9px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              12/05/2026 · Transferencia
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 px-1.5 py-0.5 font-semibold">
                <AlertTriangle size={9} /> Siniestro
              </span>
            </div>
          </div>
        </div>
        <span className="text-[12px] font-bold text-red-600">- $ 250.000</span>
      </div>
      <div className="rounded-md bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 px-2.5 py-1.5 flex items-center gap-1.5">
        <CheckCircle2 size={12} /> El egreso queda en <b>Caja</b>, vinculado al siniestro.
      </div>
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "registrar",
    label: "Registrar",
    icon: <Plus size={14} />,
    steps: [
      {
        title: 'Abrí "Registrar Siniestro"',
        description:
          'Arriba a la derecha, botón azul "+ Registrar Siniestro" (al lado del botón Tutorial). Se abre un formulario centrado. Necesitás permiso de edición en Siniestros.',
        mockup: <MockToolbar />,
      },
      {
        title: "Cargá los datos del siniestro",
        description:
          "Camión, Fecha, Tipo, Estado y la Descripción del accidente son obligatorios. El chofer es opcional. Después sumás monto de daños, compañía de seguro, N° de reclamo y terceros involucrados.",
        mockup: <MockNewSiniestroForm />,
        hint: (
          <>
            El <b>tipo</b> puede ser{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">choque</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">robo</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">incendio</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">vandalismo</code>,{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">vuelco</code> u{" "}
            <code className="text-[11px] bg-card border border-border px-1 rounded">otro</code>. Si elegís
            <b> Otro</b>, te pide especificar (granizo, animal en ruta…). El <b>estado</b> arranca en{" "}
            <b>Abierto</b>.
          </>
        ),
      },
      {
        title: "Ojo con el chofer y su legajo",
        description:
          "En el selector de chofer, los que tienen el legajo incompleto aparecen con ⚠ y no se pueden elegir hasta cargar sus datos. Como es opcional, si no aplica dejá “Sin chofer / Otro”.",
        mockup: <MockChoferSelect />,
      },
      {
        title: "Guardá y listo",
        description:
          'Apretá "Registrar siniestro". Ves un cartel verde de confirmación, el modal se cierra y el siniestro aparece en la lista ordenado por fecha. Suma a las tarjetas de arriba.',
        mockup: <MockSiniestroListItem />,
      },
    ],
  },
  {
    id: "gestionar",
    label: "Ver y gestionar",
    icon: <Eye size={14} />,
    steps: [
      {
        title: "Las tarjetas y el buscador",
        description:
          "Arriba, 4 tarjetas: total de siniestros, costo de daños acumulado, siniestros de este mes y camiones afectados. El buscador filtra la lista por patente, chofer, tipo, estado o descripción.",
        mockup: <MockSearch />,
      },
      {
        title: "Clic en la fila para el detalle",
        description:
          "Cada fila muestra fecha, camión, chofer, tipo y estado con etiquetas de color, más el monto. Hacé clic en la fila (o en la flechita) para desplegar el panel con la unidad, el chofer, los datos del seguro y la descripción completa.",
        mockup: <MockRowExpand />,
        hint: "El tipo y el estado son etiquetas de color: así ves de un vistazo qué siniestros siguen Abiertos o En gestión.",
      },
      {
        title: "Editá o eliminá el registro",
        description:
          'El botón "Editar" reabre el formulario para cambiar cualquier dato —por ejemplo pasar el estado a En gestión o Cerrado—. "Eliminar" borra el registro y te pide confirmación antes.',
        mockup: <MockEditDelete />,
      },
    ],
  },
  {
    id: "adjuntos",
    label: "Fotos y archivos",
    icon: <Paperclip size={14} />,
    steps: [
      {
        title: "Adjuntá al siniestro",
        description:
          'Dentro del detalle desplegado, abajo de todo está "Archivos adjuntos". Con "Adjuntar" sumás fotos del choque, el parte policial, el informe del seguro o hasta un video.',
        mockup: <MockAdjuntarBtn />,
      },
      {
        title: "Subí varios a la vez",
        description:
          "Elegís uno o varios archivos y, si querés, una descripción común. Se suben todos juntos; se permiten videos y archivos pesados (hasta 20 MB cada uno).",
        mockup: <MockAdjuntarForm />,
        hint: "Podés meter fotos, parte, informe y video en una sola tanda. Van por subida directa, así entran los videos.",
      },
      {
        title: "Galería y documentos",
        description:
          "Las fotos se ven como galería de miniaturas; al hacer clic se abren en grande con flechas para pasar de una a otra. Los PDF y documentos quedan en una lista aparte, cada uno con su botón para descargar o borrar.",
        mockup: <MockGaleria />,
      },
    ],
  },
  {
    id: "pagos",
    label: "Pago en caja",
    icon: <Banknote size={14} />,
    steps: [
      {
        title: "Registrá lo que costó",
        description:
          'En el detalle del siniestro, en el bloque "Seguro y daños", el botón verde "Registrar pago en caja" abre la ventana para cargar el egreso.',
        mockup: <MockPagoBtn />,
      },
      {
        title: "Cargá el pago",
        description:
          'Monto (viene precargado con el daño estimado, editable), fecha, medio de pago (efectivo, transferencia, cheque u otro) y observaciones. Apretás "Registrar egreso".',
        mockup: <MockPagoForm />,
        hint: "El medio arranca en Transferencia. Podés cargar pagos parciales si el seguro cubre una parte.",
      },
      {
        title: "Queda en Caja, vinculado",
        description:
          "El pago se anota como egreso en Caja con el concepto del siniestro y linkeado a este registro. Así el gasto impacta en las finanzas y queda trazable desde ambos lados.",
        mockup: <MockPagoResultado />,
      },
    ],
  },
];

export default function HelpTutorialButton() {
  return <HelpTutorialDialog title="Guía de Siniestros" tabs={TABS} />;
}
