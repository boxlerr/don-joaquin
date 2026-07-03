"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Upload,
  Wallet,
  Calendar,
  DollarSign,
  Tag,
  User,
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
    id: "movimientos",
    label: "Ingresos y egresos",
    icon: <Wallet size={14} />,
    steps: [
      {
        title: "El saldo se calcula solo",
        description:
          "La caja arranca con 4 tarjetas: saldo actual, ingresos del mes, egresos del mes y total de movimientos. El saldo es ingresos menos egresos de todo el histórico — no se carga a mano.",
        mockup: <MockStats />,
      },
      {
        title: "Registrá un ingreso",
        description:
          'El botón verde "Ingreso" suma dinero a la caja (aportes, rendiciones). Cargás fecha, monto y concepto.',
        mockup: <MockIngreso />,
      },
      {
        title: "Registrá un egreso",
        description:
          'El botón rojo "Egreso" descuenta de la caja. Además del monto y la fecha, elegís el tipo de gasto para mantener la trazabilidad.',
        mockup: <MockEgreso />,
        hint: "Ingreso = entra plata (verde). Egreso = sale plata (rojo). El saldo se actualiza al instante.",
      },
    ],
  },
  {
    id: "viaticos",
    label: "Viáticos e importación",
    icon: <Receipt size={14} />,
    steps: [
      {
        title: "Registrá un viático",
        description:
          'El botón "Registrar viático" carga un adelanto/viático a un chofer. Queda asociado a su cuenta corriente además de impactar en la caja.',
        mockup: <MockViatico />,
      },
      {
        title: "Importá movimientos masivos",
        description:
          'Con "Importar" subís un Excel/CSV con varios movimientos de una sola vez. Vas a ver una vista previa antes de confirmar; nada se guarda hasta que aceptás.',
        mockup: <MockImport />,
        hint: "Las acciones de carga (viático, ingreso, egreso, importar) solo aparecen con permiso de edición sobre Finanzas.",
      },
    ],
  },
];

function MockStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border bg-card p-2 col-span-2">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Wallet size={9} className="text-primary" /> Saldo actual
        </div>
        <div className="text-base font-bold text-foreground">$ 3.480.000</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-[#065F46] uppercase tracking-wide">Ingresos del mes</div>
        <div className="text-sm font-bold text-[#065F46]">$ 1.900.000</div>
      </div>
      <div className="rounded-md border border-border bg-card p-2">
        <div className="text-[9px] text-[#DC2626] uppercase tracking-wide">Egresos del mes</div>
        <div className="text-sm font-bold text-[#DC2626]">$ 740.000</div>
      </div>
    </div>
  );
}

function MockIngreso() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[420px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#ECFDF5] text-[#065F46] inline-flex items-center justify-center">
          <ArrowUpRight size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Nuevo ingreso</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha *" value="20/05/2026" icon={<Calendar size={11} />} required />
          <MockField label="Monto *" value="$ 250.000" icon={<DollarSign size={11} />} required />
        </div>
        <MockField label="Concepto *" value="Rendición de vuelto viáticos" required />
      </div>
    </div>
  );
}

function MockEgreso() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[420px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#FEE2E2] text-[#DC2626] inline-flex items-center justify-center">
          <ArrowDownRight size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Nuevo egreso</div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha *" value="20/05/2026" icon={<Calendar size={11} />} required />
          <MockField label="Monto *" value="$ 80.000" icon={<DollarSign size={11} />} required />
        </div>
        <MockField label="Tipo de gasto *" value="Insumos oficina" icon={<Tag size={11} />} required />
      </div>
    </div>
  );
}

function MockViatico() {
  return (
    <div className="bg-card border border-border rounded-lg shadow-md w-full max-w-[420px] mx-auto overflow-hidden">
      <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center gap-2">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <Receipt size={14} />
        </span>
        <div className="text-foreground text-xs font-bold uppercase tracking-wider">Registrar viático</div>
      </div>
      <div className="p-4 space-y-3">
        <MockField label="Chofer *" value="Pérez, Juan" icon={<User size={11} />} required />
        <div className="grid grid-cols-2 gap-3">
          <MockField label="Fecha *" value="20/05/2026" required />
          <MockField label="Monto *" value="$ 35.000" required />
        </div>
        <div className="bg-[#E1F5FE] text-[#004A99] text-[11px] px-3 py-1.5 rounded-md">
          Impacta en la caja y en la cuenta corriente del chofer.
        </div>
      </div>
    </div>
  );
}

function MockImport() {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm max-w-[420px] mx-auto">
      <div className="px-3 py-2 border-b border-border text-foreground text-xs font-semibold">
        Importar movimientos
      </div>
      <div className="p-3 space-y-2">
        <div className="h-8 px-2 rounded border border-dashed border-[#94A3B8] text-[11px] text-muted-foreground bg-muted/40 inline-flex items-center gap-2 w-full">
          <Upload size={12} className="text-primary" /> movimientos-mayo.xlsx
        </div>
        <div className="rounded-md bg-[#F0F9FF] border border-[#BAE6FD] text-[11px] text-[#075985] p-2">
          Vista previa: 14 válidos · 1 con error. Se importarán 14.
        </div>
      </div>
    </div>
  );
}
