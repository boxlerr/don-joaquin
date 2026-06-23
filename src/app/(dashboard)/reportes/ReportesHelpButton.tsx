"use client";

import {
  CalendarRange,
  LayoutList,
  Trophy,
  Building2,
  Users,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda de Reportes. Explica el selector de período y los tres
 * reportes (productividad de choferes, clientes y rotación). */
export default function ReportesHelpButton() {
  return <HelpTutorialDialog title="Guía de Reportes" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "periodo",
    label: "El período",
    icon: <CalendarRange size={14} />,
    steps: [
      {
        title: "Todo se calcula sobre un período",
        description:
          "Arriba elegís la ventana de tiempo: Este mes, Últimos 3 meses o Último año. Todos los reportes de la página se recalculan para ese rango.",
        mockup: <MockPeriodo />,
        hint: "Por defecto se muestran los últimos 3 meses: suele dar un panorama más estable que un solo mes.",
      },
      {
        title: "Datos en vivo",
        description:
          "Los reportes salen directo de los viajes, choferes y clientes cargados. No hay que generarlos a mano: cada vez que entrás, reflejan lo último que se cargó en el sistema.",
        mockup: <MockVivo />,
      },
    ],
  },
  {
    id: "reportes",
    label: "Los reportes",
    icon: <LayoutList size={14} />,
    steps: [
      {
        title: "Productividad de choferes",
        description:
          "El top 10 del período por score operativo, con viajes, km, % de vacíos, facturación y $/km. Tocá un chofer para abrir su legajo o el enlace para ver el ranking completo.",
        mockup: <MockProductividad />,
      },
      {
        title: "Km y facturación por cliente",
        description:
          "Cuánto movió y facturó cada cliente en el período, ordenado por facturación. Sirve para ver de un vistazo qué cuentas pesan más.",
        mockup: <MockClientes />,
      },
      {
        title: "Rotación de choferes",
        description:
          "El índice de rotación del año en curso: dotación actual, altas, bajas e índice. Cada tarjeta enlaza a su sección para ver el detalle.",
        mockup: <MockRotacion />,
        hint: "Un índice de rotación alto (en rojo) es señal de que conviene revisar por qué se van los choferes.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockPeriodo() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center bg-muted text-muted-foreground">
        Este mes
      </div>
      <div className="h-8 px-3 rounded-md text-[11px] font-bold inline-flex items-center bg-[#0088D1] text-white shadow-sm ring-2 ring-[#0088D1]/20">
        Últimos 3 meses
      </div>
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center bg-muted text-muted-foreground">
        Último año
      </div>
    </div>
  );
}

function MockVivo() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center space-y-1.5">
      <TrendingUp size={20} className="mx-auto text-primary" />
      <p className="text-[11px] text-foreground font-semibold">Siempre actualizado</p>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Se arman solos con los viajes y choferes cargados. No hay que exportar ni generar nada.
      </p>
    </div>
  );
}

function MockReportHeader({
  Icon,
  title,
  subtitle,
  link,
}: {
  Icon: typeof Trophy;
  title: string;
  subtitle: string;
  link: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <div>
          <div className="text-[11px] font-bold text-foreground leading-tight">{title}</div>
          <div className="text-[9px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-primary inline-flex items-center gap-0.5">
        {link}
        <ChevronRight size={11} />
      </span>
    </div>
  );
}

function MockProductividad() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <MockReportHeader Icon={Trophy} title="Productividad de choferes" subtitle="Top 10 del período" link="Ranking" />
      <table className="w-full text-[10px]">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-left font-semibold">Chofer</th>
            <th className="px-2 py-1 text-right font-semibold">Viajes</th>
            <th className="px-2 py-1 text-right font-semibold">$/km</th>
            <th className="px-2 py-1 text-right font-semibold">Score</th>
          </tr>
        </thead>
        <tbody>
          {[
            { n: "Arias, Cesar", v: "48", k: "$ 1.2k", s: "92", c: "#22C55E" },
            { n: "Pérez, Juan", v: "42", k: "$ 980", s: "78", c: "#F59E0B" },
          ].map((r) => (
            <tr key={r.n} className="border-t border-border">
              <td className="px-2 py-1 text-foreground">{r.n}</td>
              <td className="px-2 py-1 text-right text-muted-foreground">{r.v}</td>
              <td className="px-2 py-1 text-right text-muted-foreground">{r.k}</td>
              <td className="px-2 py-1 text-right">
                <span className="font-bold" style={{ color: r.c }}>{r.s}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockClientes() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <MockReportHeader Icon={Building2} title="Por cliente" subtitle="Volumen y facturación" link="Clientes" />
      <table className="w-full text-[10px]">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-2 py-1 text-left font-semibold">Cliente</th>
            <th className="px-2 py-1 text-right font-semibold">Km</th>
            <th className="px-2 py-1 text-right font-semibold">Facturación</th>
          </tr>
        </thead>
        <tbody>
          {[
            { n: "Loma Negra", km: "84.2k", f: "$ 12.4 M" },
            { n: "YPF", km: "51.0k", f: "$ 8.1 M" },
          ].map((r) => (
            <tr key={r.n} className="border-t border-border">
              <td className="px-2 py-1 text-foreground">{r.n}</td>
              <td className="px-2 py-1 text-right text-muted-foreground">{r.km}</td>
              <td className="px-2 py-1 text-right text-[#10B981] font-medium">{r.f}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockRotacion() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <MockReportHeader Icon={Users} title="Rotación · 2026" subtitle="Índice del año" link="Detalle" />
      <div className="grid grid-cols-2 gap-2 p-2.5">
        {[
          { l: "Dotación", v: "32", c: "text-foreground" },
          { l: "Altas", v: "5", c: "text-[#10B981]" },
          { l: "Bajas", v: "3", c: "text-[#EF4444]" },
          { l: "Índice", v: "9.4%", c: "text-foreground" },
        ].map((x) => (
          <div key={x.l} className="rounded border border-border bg-muted/20 px-2 py-1.5">
            <div className="text-[9px] text-muted-foreground/70">{x.l}</div>
            <div className={`text-sm font-bold ${x.c}`}>{x.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
