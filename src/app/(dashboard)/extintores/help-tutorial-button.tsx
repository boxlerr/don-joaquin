"use client";

import {
  Upload,
  FileDown,
  ListFilter,
  Flame,
  ShieldCheck,
  AlertTriangle,
  ShieldX,
  MapPin,
} from "lucide-react";
import HelpTutorialDialog, {
  type TutorialTab,
} from "@/components/help/HelpTutorialDialog";

export default function HelpTutorialButton() {
  return <HelpTutorialDialog tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "io",
    label: "Importar / Exportar",
    icon: <Upload size={14} />,
    steps: [
      {
        title: "El inventario se carga por Excel",
        description:
          'Los extintores se gestionan de forma masiva. En la barra superior tenés "Importar" para subir el inventario y "Exportar" para bajarlo.',
        mockup: <MockToolbar />,
      },
      {
        title: "Importá el inventario",
        description:
          "Subí un .xlsx/.csv con código, tipo, ubicación (camión o establecimiento) y fecha de vencimiento de cada matafuego. Vas a ver una vista previa antes de confirmar.",
        mockup: <MockImport />,
        hint: "Para actualizar vencimientos tras una recarga, volvé a importar el archivo con las fechas nuevas.",
      },
    ],
  },
  {
    id: "vigencia",
    label: "Vigencia y filtros",
    icon: <ListFilter size={14} />,
    steps: [
      {
        title: "Leé el estado de vigencia",
        description:
          "Las 4 tarjetas resumen el inventario: total, vencidos (recarga urgente), próximos a vencer (30 días) y vigentes. Cada extintor muestra su estado con un color.",
        mockup: <MockStats />,
      },
      {
        title: "Filtrá por ubicación y vigencia",
        description:
          "La tabla se filtra por ubicación (qué camión o establecimiento) y por estado de vigencia. Así encontrás rápido los matafuegos que hay que recargar.",
        mockup: <MockFiltros />,
      },
    ],
  },
];

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="opacity-50">
        <div className="text-foreground text-sm font-bold">Extintores</div>
        <div className="text-[10px] text-muted-foreground">Vencimientos y ubicaciones de matafuegos</div>
      </div>
      <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
        <div className="h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1 bg-card border-2 border-[#0088D1] text-primary shadow-[0_0_0_4px_rgba(0,136,209,0.2)]">
          <Upload size={12} /> Importar
        </div>
        <div className="h-8 px-3 rounded-md text-xs inline-flex items-center gap-1 bg-card border border-border text-muted-foreground">
          <FileDown size={12} /> Exportar
        </div>
      </div>
    </div>
  );
}

function MockImport() {
  const rows = [
    { ok: true, cod: "EXT-01", ubic: "AB 123 CD" },
    { ok: true, cod: "EXT-02", ubic: "Depósito" },
    { ok: false, cod: "", ubic: "Falta código" },
  ];
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-border bg-muted/40 text-[11px] flex items-center gap-3">
        <span className="text-[#059669] font-bold">2 válidos</span>
        <span className="text-[#DC2626] font-bold">1 con error</span>
      </div>
      <div className="text-[10px] font-mono">
        {rows.map((r, i) => (
          <div
            key={i}
            className={"flex items-center gap-2 px-3 py-1.5 border-b last:border-0 border-[#F1F5F9] " + (r.ok ? "" : "bg-[#FEF2F2]")}
          >
            <span className={r.ok ? "text-[#10B981]" : "text-red-500"}>{r.ok ? "✓" : "✕"}</span>
            <span className="font-semibold text-foreground w-16">{r.cod || "—"}</span>
            <span className="text-muted-foreground flex-1">{r.ubic}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStats() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border bg-card p-2 flex items-center gap-2">
        <Flame size={14} className="text-primary" />
        <div>
          <div className="text-[9px] text-muted-foreground uppercase">Total</div>
          <div className="text-sm font-bold text-foreground">48</div>
        </div>
      </div>
      <div className="rounded-md border border-[#FECACA] bg-[#FEE2E2]/40 p-2 flex items-center gap-2">
        <ShieldX size={14} className="text-[#DC2626]" />
        <div>
          <div className="text-[9px] text-[#DC2626] uppercase">Vencidos</div>
          <div className="text-sm font-bold text-[#DC2626]">3</div>
        </div>
      </div>
      <div className="rounded-md border border-[#FCD34D] bg-[#FEF3C7]/50 p-2 flex items-center gap-2">
        <AlertTriangle size={14} className="text-[#B45309]" />
        <div>
          <div className="text-[9px] text-[#B45309] uppercase">Por vencer</div>
          <div className="text-sm font-bold text-[#B45309]">6</div>
        </div>
      </div>
      <div className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] p-2 flex items-center gap-2">
        <ShieldCheck size={14} className="text-[#065F46]" />
        <div>
          <div className="text-[9px] text-[#065F46] uppercase">Vigentes</div>
          <div className="text-sm font-bold text-[#065F46]">39</div>
        </div>
      </div>
    </div>
  );
}

function MockFiltros() {
  const rows = [
    { cod: "EXT-01", ubic: "AB 123 CD", estado: "Vigente", tone: "ok" },
    { cod: "EXT-07", ubic: "Depósito", estado: "Por vencer", tone: "warn" },
    { cod: "EXT-12", ubic: "Oficina", estado: "Vencido", tone: "bad" },
  ];
  const cls: Record<string, string> = {
    ok: "text-[#065F46] bg-[#ECFDF5] border-[#A7F3D0]",
    warn: "text-[#B45309] bg-[#FEF3C7] border-[#FCD34D]",
    bad: "text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]",
  };
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="h-7 px-2 rounded border border-border bg-card inline-flex items-center gap-1">
          <MapPin size={10} /> Todas las ubicaciones ▾
        </span>
        <span className="h-7 px-2 rounded border-2 border-[#0088D1] bg-[#E1F5FE] text-primary font-semibold inline-flex items-center">
          Vencidos ▾
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.cod} className="px-3 py-2 flex items-center gap-3 text-[11px] border-b last:border-0 border-[#F1F5F9]">
          <span className="font-mono text-foreground w-16">{r.cod}</span>
          <span className="flex-1 text-muted-foreground">{r.ubic}</span>
          <span className={"text-[10px] px-2 py-0.5 rounded-full border " + cls[r.tone]}>{r.estado}</span>
        </div>
      ))}
    </div>
  );
}
