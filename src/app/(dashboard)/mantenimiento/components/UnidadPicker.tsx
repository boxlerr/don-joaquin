"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Truck, Container, X } from "lucide-react";
import type { AcopladoOption, CamionOption } from "../types";

// Algunos camiones/acoplados se cargaron solo con patente — marca/modelo
// quedaron como "Sin datos". Filtramos para no mostrar la muletilla.
function isPlaceholder(v: string | null | undefined): boolean {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  return s === "" || s === "sin datos" || s === "-" || s === "—";
}

function descripcion(u: { marca?: string | null; modelo?: string | null }): string {
  const marca = isPlaceholder(u.marca) ? "" : u.marca!.trim();
  const modelo = isPlaceholder(u.modelo) ? "" : u.modelo!.trim();
  return [marca, modelo].filter(Boolean).join(" ");
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export type UnidadValue = `c:${string}` | `a:${string}` | "";

type Pos = { left: number; top: number; width: number; openUp: boolean; maxH: number };

export default function UnidadPicker({
  value,
  onChange,
  camiones,
  acoplados,
  mode = "ambos",
  id,
  placeholder = "Seleccionar unidad...",
}: {
  value: UnidadValue;
  onChange: (v: UnidadValue) => void;
  camiones: CamionOption[];
  acoplados?: AcopladoOption[];
  mode?: "camion" | "ambos";
  id?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"camion" | "acoplado">("camion");
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const acoplados_ = acoplados ?? [];

  useEffect(() => setMounted(true), []);

  // Calcula posición del popup anclado al trigger, dentro de viewport,
  // flipeando hacia arriba si no hay espacio abajo.
  const recompute = () => {
    const t = triggerRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const vh = window.innerHeight;
    const GAP = 4;
    const PAD = 12; // borde de la ventana
    const desiredH = 380; // alto máximo deseado
    const spaceBelow = vh - rect.bottom - PAD;
    const spaceAbove = rect.top - PAD;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxH = Math.max(220, Math.min(desiredH, openUp ? spaceAbove - GAP : spaceBelow - GAP));
    setPos({
      left: rect.left,
      top: openUp ? rect.top - GAP : rect.bottom + GAP,
      width: rect.width,
      openUp,
      maxH,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    recompute();
    const onScrollOrResize = () => recompute();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  // Cierra al clickear afuera (trigger o popup) o ESC.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPopup = popupRef.current?.contains(target);
      if (!inTrigger && !inPopup) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const selected = useMemo(() => {
    if (!value) return null;
    if (value.startsWith("c:")) {
      const c = camiones.find((x) => x.id === value.slice(2));
      return c ? { tipo: "camion" as const, patente: c.patente, sub: descripcion(c) } : null;
    }
    const a = acoplados_.find((x) => x.id === value.slice(2));
    return a ? { tipo: "acoplado" as const, patente: a.patente, sub: descripcion(a) } : null;
  }, [value, camiones, acoplados_]);

  const q = norm(query);
  const filteredCamiones = useMemo(
    () =>
      camiones.filter((c) => {
        if (!q) return true;
        return norm(c.patente).includes(q) || norm(descripcion(c)).includes(q);
      }),
    [camiones, q]
  );
  const filteredAcoplados = useMemo(
    () =>
      acoplados_.filter((a) => {
        if (!q) return true;
        return norm(a.patente).includes(q) || norm(descripcion(a)).includes(q);
      }),
    [acoplados_, q]
  );

  const lista = mode === "camion" ? filteredCamiones : tab === "camion" ? filteredCamiones : filteredAcoplados;
  const totalSinFiltrar = mode === "camion" ? camiones.length : tab === "camion" ? camiones.length : acoplados_.length;

  const handlePick = (tipo: "c" | "a", uid: string) => {
    onChange(`${tipo}:${uid}` as UnidadValue);
    setOpen(false);
  };

  const popup =
    open && pos && mounted
      ? createPortal(
          <div
            ref={popupRef}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              width: pos.width,
              maxHeight: pos.maxH,
              zIndex: 1000,
            }}
            className="flex flex-col rounded-lg border border-border bg-popover shadow-xl ring-1 ring-foreground/10 overflow-hidden"
          >
            {mode === "ambos" && (
              <div className="flex items-center gap-1 border-b border-border p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setTab("camion")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    tab === "camion" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Truck size={12} /> Camiones <span className="text-muted-foreground/70">({camiones.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("acoplado")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    tab === "acoplado" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Container size={12} /> Acoplados <span className="text-muted-foreground/70">({acoplados_.length})</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 shrink-0">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribí patente, marca o modelo…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex-1 overflow-y-auto py-1 min-h-0">
              {lista.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {totalSinFiltrar === 0 ? "No hay unidades cargadas." : `Sin resultados para "${query}".`}
                </p>
              ) : (
                lista.map((u) => {
                  const isCamion = mode === "camion" || tab === "camion";
                  const tipo = isCamion ? "c" : "a";
                  const isActive = value === `${tipo}:${u.id}`;
                  const sub = descripcion(u);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handlePick(tipo, u.id)}
                      className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                      }`}
                    >
                      <span className="font-mono font-medium text-foreground">{u.patente}</span>
                      {sub && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
              {lista.length} de {totalSinFiltrar} {(mode === "camion" || tab === "camion") ? "camiones" : "acoplados"}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30"
      >
        {selected ? (
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
              {selected.tipo === "camion" ? "Camión" : "Acoplado"}
            </span>
            <span className="font-mono font-medium text-foreground truncate">{selected.patente}</span>
            {selected.sub && <span className="text-xs text-muted-foreground truncate">{selected.sub}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Limpiar selección"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
      </button>
      {popup}
    </>
  );
}
