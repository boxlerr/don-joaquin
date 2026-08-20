"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { RangoKey } from "./lib";

interface Props {
  rangoActual: RangoKey;
  desdeActual: string;
  hastaActual: string;
  /** Agrega el chip "Total" (histórico completo). */
  incluirTotal?: boolean;
  /**
   * Modo compacto: en vez de la tira de chips, un solo botón con el período
   * vigente que abre un menú con todas las opciones. Lo usa el encabezado del
   * dashboard, donde siete chips sueltos sobre la foto quedaban desprolijos.
   */
  compacto?: boolean;
}

const CHIPS: Array<{ key: RangoKey; label: string }> = [
  { key: "1m", label: "Último mes" },
  { key: "3m", label: "3 meses" },
  { key: "1y", label: "1 año" },
];

/** Rótulos largos para el botón del modo compacto. */
const CHIP_LARGO: Record<string, string> = {
  "1m": "Último mes",
  "3m": "Últimos 3 meses",
  "1y": "Último año",
  total: "Histórico total",
};

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const dosDig = (n: number) => String(n).padStart(2, "0");
/** Primer y último día de un mes, en ISO local (sin pasar por UTC). */
const rangoDelMes = (y: number, m: number) => ({
  desde: `${y}-${dosDig(m + 1)}-01`,
  hasta: `${y}-${dosDig(m + 1)}-${dosDig(new Date(y, m + 1, 0).getDate())}`,
});

/** Si el rango es exactamente un mes calendario, devuelve {y, m}. */
function mesExacto(desde: string, hasta: string): { y: number; m: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
  const [y, m] = desde.split("-").map(Number);
  const r = rangoDelMes(y, m - 1);
  return r.desde === desde && r.hasta === hasta ? { y, m: m - 1 } : null;
}

export default function PeriodoSelector({
  rangoActual,
  desdeActual,
  hastaActual,
  incluirTotal,
  compacto = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mesOpen, setMesOpen] = useState(false);
  /** Solo en modo compacto: el menú que contiene todo lo demás. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [desde, setDesde] = useState(desdeActual);
  const [hasta, setHasta] = useState(hastaActual);
  const popRef = useRef<HTMLDivElement>(null);
  const mesRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Si el período vigente es justo un mes, el botón lo muestra y lo marca.
  const mesSel = rangoActual === "custom" ? mesExacto(desdeActual, hastaActual) : null;
  const [yearView, setYearView] = useState(() => mesSel?.y ?? new Date().getFullYear());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setDesde(desdeActual);
    setHasta(hastaActual);
  }, [desdeActual, hastaActual]);

  useEffect(() => {
    if (!open && !mesOpen && !menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t)) setOpen(false);
      if (mesRef.current && !mesRef.current.contains(t)) setMesOpen(false);
      if (menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
        setOpen(false);
        setMesOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, mesOpen, menuOpen]);

  const irA = (rango: RangoKey, extra?: { desde: string; hasta: string }) => {
    const params = new URLSearchParams();
    params.set("rango", rango);
    if (rango === "custom" && extra) {
      params.set("desde", extra.desde);
      params.set("hasta", extra.hasta);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const onChipClick = (rango: RangoKey) => {
    setOpen(false);
    setMesOpen(false);
    setMenuOpen(false);
    irA(rango);
  };

  const onCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desde || !hasta || desde > hasta) return;
    setOpen(false);
    setMenuOpen(false);
    irA("custom", { desde, hasta });
  };

  const elegirMes = (y: number, m: number) => {
    setMesOpen(false);
    setMenuOpen(false);
    irA("custom", rangoDelMes(y, m));
  };

  const customActivo = rangoActual === "custom" && !mesSel;
  const customInvalido = !desde || !hasta || desde > hasta;
  const chips = incluirTotal
    ? [...CHIPS, { key: "total" as RangoKey, label: "Total" }]
    : CHIPS;

  const chipClase = (activo: boolean) =>
    `inline-flex items-center h-9 sm:h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
      activo
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  const hoy = new Date();

  // El calendario de meses y el formulario de rango son los mismos en los dos
  // modos; se arman acá una sola vez y cada modo los ubica donde le sirve.
  const mesGrid = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYearView((y) => y - 1)}
          className="inline-flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
          aria-label="Año anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-foreground">{yearView}</span>
        <button
          type="button"
          onClick={() => setYearView((y) => y + 1)}
          disabled={yearView >= hoy.getFullYear()}
          className="inline-flex size-7 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Año siguiente"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MESES_ABR.map((abr, m) => {
          const futuro = yearView > hoy.getFullYear() || (yearView === hoy.getFullYear() && m > hoy.getMonth());
          const activo = mesSel?.y === yearView && mesSel.m === m;
          return (
            <button
              key={abr}
              type="button"
              disabled={futuro}
              onClick={() => elegirMes(yearView, m)}
              className={`h-9 sm:h-8 rounded-md text-sm font-medium capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                activo
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              {abr}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => elegirMes(hoy.getFullYear(), hoy.getMonth())}
        className="mt-2 h-9 sm:h-auto w-full rounded-md border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Este mes
      </button>
    </>
  );

  const rangoForm = (
    <>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
        <input
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
          className="w-full h-9 sm:h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
        <input
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => setHasta(e.target.value)}
          className="w-full h-9 sm:h-8 px-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>
      <button
        type="submit"
        disabled={customInvalido}
        className="w-full inline-flex items-center justify-center gap-1.5 h-9 sm:h-8 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Check size={14} />
        Aplicar
      </button>
    </>
  );

  // ── Modo compacto: un botón con el período y todo lo demás adentro ─────────
  if (compacto) {
    const etiqueta = mesSel
      ? `${MESES_FULL[mesSel.m]} ${mesSel.y}`
      : customActivo
        ? "Rango elegido"
        : (CHIP_LARGO[rangoActual] ?? "Período");

    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => { setMenuOpen((v) => !v); setOpen(false); setMesOpen(false); }}
          aria-expanded={menuOpen}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/70 bg-white px-3 text-[13px] font-semibold text-[#1E293B] shadow-sm transition-colors hover:bg-white/90"
        >
          <Calendar size={14} className="text-primary" />
          {etiqueta}
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          /* En celular se centra como mini-modal: colgando del botón, el panel
             se iba del borde de la pantalla. */
          <div className="z-40 rounded-xl border border-border bg-card p-2 shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[248px]">
            <ul className="space-y-0.5">
              {chips.map((chip) => {
                const activo = rangoActual === chip.key;
                return (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={() => onChipClick(chip.key)}
                      className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-medium transition-colors ${
                        activo ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {CHIP_LARGO[chip.key] ?? chip.label}
                      {activo && <Check size={14} />}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="my-2 h-px bg-border" />

            <button
              type="button"
              onClick={() => { setMesOpen((v) => !v); setOpen(false); }}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-medium transition-colors ${
                mesSel ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Calendar size={14} />
                {mesSel ? `${MESES_FULL[mesSel.m]} ${mesSel.y}` : "Elegir mes"}
              </span>
              <ChevronDown size={14} className={`transition-transform ${mesOpen ? "rotate-180" : ""}`} />
            </button>
            {mesOpen && <div className="px-1 pb-1 pt-2">{mesGrid}</div>}

            <button
              type="button"
              onClick={() => { setOpen((v) => !v); setMesOpen(false); }}
              className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm font-medium transition-colors ${
                customActivo ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              Otro rango
              <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <form onSubmit={onCustomSubmit} className="space-y-2.5 px-1 pb-1 pt-2">
                {rangoForm}
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Modo por defecto: la tira de chips (ranking de choferes) ──────────────
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-1.5">
      {chips.map((chip) => (
        <button key={chip.key} type="button" onClick={() => onChipClick(chip.key)} className={chipClase(rangoActual === chip.key)}>
          {chip.label}
        </button>
      ))}

      {/* Elegir UN mes: es lo que más se usa y con dos date pickers costaba. */}
      <div className="relative" ref={mesRef}>
        <button
          type="button"
          onClick={() => { setMesOpen((v) => !v); setOpen(false); }}
          className={`${chipClase(!!mesSel)} gap-1.5`}
        >
          <Calendar size={14} />
          {mesSel ? `${MESES_FULL[mesSel.m]} ${mesSel.y}` : "Elegir mes"}
        </button>

        {mesOpen && (
          /* En celular se centra como mini-modal (mismo criterio que MonthPicker):
             colgando del botón, los 256px se iban del borde de la pantalla. */
          <div className="z-30 rounded-lg border border-border bg-card p-3 shadow-md max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-64">
            {mesGrid}
          </div>
        )}
      </div>

      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setMesOpen(false); }}
          className={`${chipClase(customActivo)} gap-1.5`}
        >
          Otro rango
        </button>

        {open && (
          <form
            onSubmit={onCustomSubmit}
            className="z-30 bg-card border border-border rounded-lg shadow-md p-3 space-y-2.5 max-sm:fixed max-sm:inset-x-4 max-sm:top-1/2 max-sm:-translate-y-1/2 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-72"
          >
            {rangoForm}
          </form>
        )}
      </div>
    </div>
  );
}
