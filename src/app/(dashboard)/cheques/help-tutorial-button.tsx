"use client";

import {
  Plus,
  Workflow,
  Building2,
  Calendar,
  DollarSign,
  User,
  FileDown,
} from "lucide-react";
import HelpTutorialDialog, {
  MockField,
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "registrar",
    label: "Registrar cheque",
    icon: <Plus size={14} />,
    steps: [
      {
        title: 'Abrí "Registrar cheque"',
        description:
          'Arriba a la derecha, hacé clic en "+ Registrar cheque". Se abre un modal centrado.',
        mockup: <MockToolbar />,
      },
      {
        title: "Cargá los datos del cheque",
        description:
          "Número, importe, banco, librador y las fechas de emisión y vencimiento. Podés vincularlo a un cliente. Entra en estado “En cartera”.",
        mockup: <MockChequeForm />,
        hint: "El banco y el cliente salen de catálogos: si falta uno, cargalo primero en su sección.",
      },
      {
        title: "Mirá las tarjetas de cartera",
        description:
          "El encabezado resume el dinero en cartera, lo que vence en los próximos 7 días y lo ya vencido sin gestionar. Te dice qué cheques mover primero.",
        mockup: <MockStats />,
      },
    ],
  },
  {
    id: "estados",
    label: "Estados y cartera",
    icon: <Workflow size={14} />,
    steps: [
      {
        title: "El ciclo de vida del cheque",
        description:
          "Un cheque pasa por: En cartera → Entregado o Depositado → Acreditado. También puede terminar en Rechazado o Anulado. Cada estado tiene su color.",
        mockup: <MockCiclo />,
      },
      {
        title: "Cambiá de estado según corresponda",
        description:
          "En cada cheque, las acciones disponibles dependen de su estado actual: desde cartera podés entregarlo a un tercero, depositarlo o marcarlo rechazado. El sistema no te deja transiciones inválidas.",
        mockup: <MockAcciones />,
      },
      {
        title: "Filtrá y exportá",
        description:
          'Filtrá la lista por estado (En cartera, Entregados, Depositados, Acreditados, Rechazados, Anulados) y usá "Exportar" para bajar la cartera a Excel.',
        mockup: <MockFiltros />,
      },
    ],
  },
];

function MockToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Gestión de Cheques</div>
        <div className="text-[10px] text-muted-foreground">Cartera con trazabilidad por estado</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 px-3 rounded-md text-xs inline-flex items-center gap-1 bg-card border border-border text-muted-foreground opacity-50">
          <FileDown size={12} /> Exportar
        </div>
        <div className="h-9 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
          <Plus size={14} /> Registrar cheque
        </div>
      </div>
    </div>
  );
}

function MockChequeForm() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[440px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] text-foreground text-xs font-bold uppercase tracking-wider">
        Registrar cheque
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Número *" value="00123456" required />
          <MockField label="Importe *" value="$ 480.000" icon={<DollarSign size={11} />} required />
        </div>
        <MockField label="Banco *" value="Banco Nación" icon={<Building2 size={11} />} required />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Emisión *" value="01/05/2026" icon={<Calendar size={11} />} required />
          <MockField label="Vencimiento *" value="30/06/2026" icon={<Calendar size={11} />} required />
        </div>
        <MockField label="Librador / Cliente" value="Don Joaquín SA" icon={<User size={11} />} />
      </div>
    </div>
  );
}

function MockStats() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-primary uppercase tracking-wide">En cartera</div>
        <div className="text-sm font-bold text-foreground">$ 2.1M</div>
      </div>
      <div className="rounded-md border border-[#FCD34D] bg-[#FEF3C7]/50 p-2">
        <div className="text-[9px] text-[#B45309] uppercase tracking-wide">Por vencer 7d</div>
        <div className="text-sm font-bold text-[#B45309]">$ 480k</div>
      </div>
      <div className="rounded-md border border-[#FECACA] bg-[#FEE2E2]/40 p-2">
        <div className="text-[9px] text-[#DC2626] uppercase tracking-wide">Vencidos</div>
        <div className="text-sm font-bold text-[#DC2626]">$ 90k</div>
      </div>
    </div>
  );
}

function MockCiclo() {
  const flow = [
    { label: "En cartera", color: "bg-[#E1F5FE] text-primary border-[#90CAF9]" },
    { label: "Depositado", color: "bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]" },
    { label: "Acreditado", color: "bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]" },
  ];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {flow.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${s.color}`}>
              {s.label}
            </span>
            {i < flow.length - 1 && <span className="text-muted-foreground/70 text-sm">→</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="px-3 py-1 rounded-full text-[10px] font-semibold border bg-muted text-muted-foreground border-border">
          Entregado a tercero
        </span>
        <span className="px-3 py-1 rounded-full text-[10px] font-semibold border bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]">
          Rechazado
        </span>
        <span className="px-3 py-1 rounded-full text-[10px] font-semibold border bg-muted text-muted-foreground/70 border-border">
          Anulado
        </span>
      </div>
    </div>
  );
}

function MockAcciones() {
  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-foreground">Cheque #00123456</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E1F5FE] text-primary">En cartera</span>
      </div>
      <div className="border-t border-[#F1F5F9] pt-2 flex flex-wrap gap-1.5">
        <span className="h-7 px-2.5 text-[11px] rounded border border-border bg-card text-foreground inline-flex items-center">Entregar a tercero</span>
        <span className="h-7 px-2.5 text-[11px] rounded border border-border bg-card text-foreground inline-flex items-center">Depositar en banco</span>
        <span className="h-7 px-2.5 text-[11px] rounded border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] inline-flex items-center">Rechazado</span>
      </div>
    </div>
  );
}

function MockFiltros() {
  const tabs = ["Todos", "En cartera", "Depositados", "Acreditados", "Rechazados"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tabs.map((t, i) => (
        <span
          key={t}
          className={
            "px-2.5 py-1 rounded-full text-[11px] font-medium border " +
            (i === 1
              ? "bg-[#0088D1] text-white border-[#0088D1]"
              : "bg-card text-muted-foreground border-border")
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}
