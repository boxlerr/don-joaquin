"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import { Gauge, MousePointerClick, TrendingDown, Trophy } from "lucide-react";

/** Botón de ayuda de la sección Ranking. Explica cómo se arma el score y cómo
 * usar la herramienta. Reusa el diálogo de tutorial estándar del sistema. */
export default function RankingHelpButton() {
  return <HelpTutorialDialog title="Guía del Ranking" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "score",
    label: "Cómo funciona",
    icon: <Gauge size={14} />,
    steps: [
      {
        title: "Todos arrancan en 100",
        description:
          "Cada chofer parte el período con 100 puntos. El sistema NO premia: arranca de la nota máxima y va RESTANDO por cada cosa mala que pasó en el período. Lo que queda es su score.",
        mockup: <MockScoreBase />,
        hint: "Solo entran al ranking los choferes que tienen al menos un viaje cargado en el período. El resto queda como “Sin actividad”.",
      },
      {
        title: "Qué resta puntos",
        description:
          "Cada concepto descuenta una cantidad de puntos configurable. Cuantas más veces pasa algo malo, más resta. El score nunca baja de 0.",
        mockup: <MockPenalizaciones />,
        hint: "Los “km vacíos” pesan poco a propósito: muchas veces el chofer viaja vacío porque no hay retorno, no por culpa suya.",
      },
      {
        title: "El semáforo",
        description:
          "El número se pinta solo: verde si está bien, amarillo si hay que prestar atención, rojo si está mal. Así de un vistazo sabés con quién hablar.",
        mockup: <MockSemaforo />,
      },
      {
        title: "El período importa",
        description:
          "Arriba elegís el período: últimos 3 meses (por defecto), 1 mes, 1 año o un rango a medida. Cuanto más datos, más confiable el score.",
        mockup: <MockPeriodo />,
        hint: "Si elegís un período con muy pocos viajes (ej. el mes recién arrancó), el sistema te avisa que el score todavía no es representativo.",
      },
    ],
  },
  {
    id: "uso",
    label: "Cómo usarlo",
    icon: <MousePointerClick size={14} />,
    steps: [
      {
        title: "Ordená por lo que te importa",
        description:
          "Tocá el encabezado de cualquier columna (Score, Viajes, KM, Facturación, $/km, Roturas…) para ordenar el ranking por esa métrica. Volvé a tocar para invertir el orden.",
        mockup: <MockOrdenar />,
      },
      {
        title: "Compará dos choferes",
        description:
          "Tildá el casillero de dos choferes y apretá “Comparar”. Se abre una vista lado a lado con todas sus métricas enfrentadas.",
        mockup: <MockComparar />,
        hint: "Sirve para decisiones difíciles: dos parecidos, ¿cuál conviene? Lo ves en números.",
      },
      {
        title: "Ajustá los pesos",
        description:
          "Con “Configurar criterios” cambiás cuántos puntos resta cada cosa. ¿Para vos una rotura es más grave que un apercibimiento? Subile el peso. El ranking se recalcula al instante.",
        mockup: <MockCriterios />,
      },
      {
        title: "Entrá al legajo",
        description:
          "Hacé clic en cualquier fila para ir al legajo del chofer y ver el detalle: sus viajes, apercibimientos, roturas, siniestros y ausencias del período.",
        mockup: <MockLegajo />,
        hint: "Es la herramienta para decidir un adelanto o un préstamo: mirás el score y el detalle, y resolvés con datos.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockScoreBase() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-full bg-[#ECFDF5] text-[#064E3B] inline-flex items-center justify-center text-[11px] font-bold">PA</span>
          <div>
            <div className="text-xs font-semibold text-foreground">Pérez, Juan</div>
            <div className="text-[10px] text-muted-foreground">OLAVARRIA</div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-[120px]">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#10B981]" style={{ width: "100%" }} />
          </div>
          <span className="text-sm font-bold text-[#10B981]">100</span>
        </div>
      </div>
      <div className="text-center text-[11px] text-muted-foreground">
        Empieza en <b className="text-foreground">100</b> · cada cosa mala resta
      </div>
    </div>
  );
}

function MockPenalizaciones() {
  const rows = [
    { c: "Siniestro / accidente", v: "−20" },
    { c: "Apercibimiento", v: "−8" },
    { c: "Ausencia injustificada", v: "−10" },
    { c: "Rotura (goma, llanta…)", v: "−5" },
    { c: "Visita al taller", v: "−3" },
    { c: "Km vacíos (mucho)", v: "−10" },
  ];
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/40 border-b border-border">
        <TrendingDown size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Penalizaciones (editables)</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.c} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-foreground">{r.c}</span>
            <span className="text-[11px] font-bold text-[#EF4444]">{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockSemaforo() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { color: "#10B981", rango: "≥ 80", label: "Bien" },
        { color: "#F59E0B", rango: "60–79", label: "Atención" },
        { color: "#EF4444", rango: "< 60", label: "Mal" },
      ].map((b) => (
        <div key={b.label} className="rounded-lg border px-3 py-3 text-center" style={{ backgroundColor: `${b.color}14`, borderColor: `${b.color}4D` }}>
          <p className="text-base font-bold" style={{ color: b.color }}>{b.rango}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{b.label}</p>
        </div>
      ))}
    </div>
  );
}

function MockPeriodo() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center bg-muted text-muted-foreground">Último mes</div>
      <div className="h-8 px-3 rounded-md text-[11px] font-bold inline-flex items-center bg-[#0088D1] text-white shadow-sm ring-2 ring-[#0088D1]/20">3 meses</div>
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center bg-muted text-muted-foreground">1 año</div>
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center bg-muted text-muted-foreground">Custom</div>
    </div>
  );
}

function MockOrdenar() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr,60px,60px] gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
        <span>Chofer</span>
        <span className="text-primary inline-flex items-center gap-0.5 justify-end">Score ↓</span>
        <span className="text-right">Roturas</span>
      </div>
      {[
        { n: "Arias, Cesar", s: "92", r: "0" },
        { n: "Pérez, Juan", s: "78", r: "2" },
        { n: "Gómez, Luis", s: "55", r: "4" },
      ].map((x) => (
        <div key={x.n} className="grid grid-cols-[1fr,60px,60px] gap-2 px-3 py-1.5 text-[11px] border-b border-border last:border-0">
          <span className="text-foreground">{x.n}</span>
          <span className="text-right font-bold text-foreground">{x.s}</span>
          <span className="text-right text-[#EF4444]">{x.r}</span>
        </div>
      ))}
      <div className="px-3 py-1.5 text-[10px] text-primary text-center bg-muted/30">Clic en un encabezado para reordenar</div>
    </div>
  );
}

function MockComparar() {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {["Arias, Cesar", "Pérez, Juan"].map((n) => (
          <div key={n} className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5">
            <span className="size-4 rounded bg-primary inline-flex items-center justify-center text-white text-[9px]">✓</span>
            <span className="text-[11px] font-medium text-foreground">{n}</span>
          </div>
        ))}
      </div>
      <div className="rounded-full bg-card border border-border shadow-sm px-3 py-1.5 inline-flex items-center gap-2 mx-auto w-fit">
        <span className="text-[11px] text-foreground"><b>Arias</b> vs <b>Pérez</b></span>
        <span className="h-6 px-3 rounded-full bg-primary text-white text-[10px] font-semibold inline-flex items-center">Comparar</span>
      </div>
    </div>
  );
}

function MockCriterios() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-[10px] font-bold text-foreground uppercase tracking-wide">Criterios del ranking</div>
      {[
        { l: "Cada siniestro", v: "20" },
        { l: "Cada rotura", v: "5" },
        { l: "Cada apercibimiento", v: "8" },
      ].map((x) => (
        <div key={x.l} className="flex items-center justify-between rounded border border-border px-2.5 py-1.5">
          <span className="text-[11px] text-foreground">{x.l}</span>
          <span className="text-[11px] text-muted-foreground">− <b className="text-foreground">{x.v}</b> pts</span>
        </div>
      ))}
      <div className="h-7 rounded-md bg-[#0088D1] text-white text-[11px] font-bold inline-flex items-center justify-center w-full">Guardar criterios</div>
    </div>
  );
}

function MockLegajo() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <span className="size-9 rounded-full bg-[#FFFBEB] text-[#78350F] inline-flex items-center justify-center text-[11px] font-bold">PJ</span>
        <div>
          <div className="text-xs font-bold text-foreground">Pérez, Juan</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7] inline-flex items-center gap-1">
              <Trophy size={9} /> Score 78
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-2.5">
        {[
          { l: "Viajes", v: "42" },
          { l: "Roturas", v: "2" },
          { l: "Apercib.", v: "1" },
        ].map((x) => (
          <div key={x.l} className="rounded border border-border bg-muted/20 p-1.5 text-center">
            <div className="text-[9px] text-muted-foreground uppercase">{x.l}</div>
            <div className="text-sm font-bold text-foreground">{x.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
