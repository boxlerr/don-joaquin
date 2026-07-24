"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Gift,
  MapPin,
  Settings,
  ShieldAlert,
  CheckCircle2,
  History,
  Trash2,
  Search,
  SlidersHorizontal,
  Flame,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
} from "lucide-react";
import { marcarAlertaVista, borrarAlerta, borrarTodasLeidas } from "./actions";
import {
  type AlertaCategoria,
  type AlertaItem,
  type Severidad,
  CATEGORIA_LABEL,
  SEVERIDAD_LABEL,
  alertaHref,
  categoriaDeAlerta,
  chipLabelFromDias,
  chipToneFromDias,
  diasRestantes,
} from "./utils";

const SEVERIDAD_ORDER: Severidad[] = ["critica", "advertencia", "info"];

// Máximo de alertas visibles por bloque antes de plegar el resto tras "Ver más".
const LIMITE_BLOQUE = 5;

// Dentro de cada grupo de severidad agrupamos los eventos de RRHH por TIPO de
// evento (todos los cumpleaños juntos, todos los aniversarios juntos), sin
// separar por entidad — así la lista no queda con los cumpleaños desperdigados.
// Dentro de cada bloque el desempate es por fecha (ver `grouped`).
const EVENTO_TIPO_PRIORITY: Record<string, number> = {
  personal_cumple: 0,
  choferes_cumple: 0,
  personal_aniversario: 1,
  choferes_aniversario: 1,
  choferes_periodo_prueba: 2,
};

// Bloques con subencabezado dentro de una severidad. El orden coincide con
// EVENTO_TIPO_PRIORITY, así los items ya vienen ordenados por bloque.
type BloqueId = "cumple" | "aniversario" | "prueba" | "otras";

const BLOQUE_META: Record<BloqueId, { label: string; emoji: string }> = {
  cumple: { label: "Cumpleaños", emoji: "🎂" },
  aniversario: { label: "Aniversarios", emoji: "🎉" },
  prueba: { label: "Períodos de prueba", emoji: "⏳" },
  otras: { label: "Otras alertas", emoji: "🔔" },
};

function bloqueDeAlerta(a: AlertaItem): BloqueId {
  switch (a.entidad_tipo) {
    case "personal_cumple":
    case "choferes_cumple":
      return "cumple";
    case "personal_aniversario":
    case "choferes_aniversario":
      return "aniversario";
    case "choferes_periodo_prueba":
      return "prueba";
    default:
      return "otras";
  }
}

// Parte los items (ya ordenados) en segmentos consecutivos por bloque.
function segmentarPorBloque(items: AlertaItem[]): { bloque: BloqueId; items: AlertaItem[] }[] {
  const segments: { bloque: BloqueId; items: AlertaItem[] }[] = [];
  for (const a of items) {
    const b = bloqueDeAlerta(a);
    const last = segments[segments.length - 1];
    if (last && last.bloque === b) last.items.push(a);
    else segments.push({ bloque: b, items: [a] });
  }
  return segments;
}

// "Urgente" = tiene fecha y ya venció o vence hoy (días restantes <= 0).
function esUrgente(a: AlertaItem): boolean {
  const d = diasRestantes(a.fecha_vencimiento);
  return d !== null && d <= 0;
}

// Acento sobrio por severidad: un punto de color + la etiqueta coloreada.
// (Nada de lomo de color, fondos pastel ni pastillas: cansaban la vista.)
const SEV_ACCENT: Record<Severidad, { dot: string; label: string }> = {
  critica: { dot: "bg-[#EF4444]", label: "text-[#DC2626]" },
  advertencia: { dot: "bg-[#F59E0B]", label: "text-[#D97706]" },
  info: { dot: "bg-[#0088D1]", label: "text-[#0369A1]" },
};

const CATEGORIA_ICON: Record<AlertaCategoria, typeof ShieldAlert> = {
  documentacion: ShieldAlert,
  cheques: FileText,
  viajes: MapPin,
  personal: Gift,
  sistema: Settings,
};

const CATEGORIA_EMPTY_MSG: Record<AlertaCategoria, string> = {
  documentacion: "No hay documentos próximos a vencer",
  cheques: "No hay cheques con alertas activas",
  viajes: "Sin viajes pendientes de cerrar ni viáticos sin rendir",
  personal: "Sin cumpleaños, aniversarios ni períodos de prueba próximos",
  sistema: "Sin eventos administrativos pendientes",
};

type SevFilter = Severidad | "todas";
type CatFilter = AlertaCategoria | "todas";

export default function NotificacionesView({
  alertas: initialAlertas,
  leidas,
}: {
  alertas: AlertaItem[];
  leidas: AlertaItem[];
}) {
  const router = useRouter();
  // Permite que el dashboard linkee directo a una categoría: ?categoria=personal
  // pre-selecciona el filtro. El usuario después puede cambiarlo libremente.
  const searchParams = useSearchParams();
  const initialCat = ((): CatFilter => {
    const raw = searchParams.get("categoria");
    const validas: CatFilter[] = ["documentacion", "cheques", "viajes", "personal", "sistema", "todas"];
    return (validas as string[]).includes(raw ?? "") ? (raw as CatFilter) : "todas";
  })();
  // Permite linkear directo a una severidad: ?severidad=critica
  const initialSev = ((): SevFilter => {
    const raw = searchParams.get("severidad");
    const validas: SevFilter[] = ["critica", "advertencia", "info", "todas"];
    return (validas as string[]).includes(raw ?? "") ? (raw as SevFilter) : "todas";
  })();
  const [alertas, setAlertas] = useState(initialAlertas);
  const [sevFilter, setSevFilter] = useState<SevFilter>(initialSev);
  const [catFilter, setCatFilter] = useState<CatFilter>(initialCat);
  const [urgentesOnly, setUrgentesOnly] = useState(false);
  const [query, setQuery] = useState("");
  // Dirección del orden por fecha dentro de cada bloque: "asc" = fecha más
  // próxima primero (las que vencen antes), "desc" = fecha más lejana primero.
  const [orden, setOrden] = useState<"asc" | "desc">("asc");
  // Colapso inteligente: por defecto solo las críticas quedan abiertas; el resto
  // arranca plegado para descargar la vista. Un deep-link ?severidad=X abre solo
  // esa sección, y un deep-link ?categoria=X (desde las alertas del dashboard)
  // llega con TODO desplegado: lo que se vino a ver tiene que estar a la vista,
  // sin un clic extra.
  const [collapsed, setCollapsed] = useState<Record<Severidad, boolean>>(() => {
    if (initialCat !== "todas") return { critica: false, advertencia: false, info: false };
    return initialSev === "todas"
      ? { critica: false, advertencia: true, info: true }
      : {
          critica: initialSev !== "critica",
          advertencia: initialSev !== "advertencia",
          info: initialSev !== "info",
        };
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Cuando se entra con ?severidad=X o ?categoria=X desde el dashboard,
  // scrollear suavemente al listado para que lo filtrado quede visible al toque.
  useEffect(() => {
    if (initialSev === "todas" && initialCat === "todas") return;
    const id = initialSev !== "todas" ? `sev-${initialSev}` : "listado-alertas";
    // Doble RAF para esperar a que el render mostró la sección antes de scrollear.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    // Solo al montar (los cambios manuales del filtro no deben re-scrollear).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alertas.filter((a) => {
      if (sevFilter !== "todas" && a.severidad !== sevFilter) return false;
      if (catFilter !== "todas" && categoriaDeAlerta(a.tipo, a.entidad_tipo) !== catFilter) return false;
      if (urgentesOnly && !esUrgente(a)) return false;
      if (q && !a.titulo.toLowerCase().includes(q) && !a.mensaje.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [alertas, sevFilter, catFilter, urgentesOnly, query]);

  const grouped = useMemo(() => {
    const map: Record<Severidad, AlertaItem[]> = {
      critica: [],
      advertencia: [],
      info: [],
    };
    for (const a of filtered) map[a.severidad].push(a);
    // Orden dentro de cada severidad:
    //  1) Agrupa los eventos de RRHH por tipo (cumpleaños, aniversarios, prueba);
    //     el resto de las alertas queda en un bloque posterior común.
    //  2) Dentro de cada bloque, por fecha de vencimiento más próxima primero.
    //     Las fechas vienen en ISO (YYYY-MM-DD), así que el orden lexicográfico
    //     coincide con el cronológico. Las alertas sin fecha van al final.
    const dir = orden === "asc" ? 1 : -1;
    for (const sev of SEVERIDAD_ORDER) {
      map[sev].sort((a, b) => {
        const pa = EVENTO_TIPO_PRIORITY[a.entidad_tipo ?? ""] ?? 99;
        const pb = EVENTO_TIPO_PRIORITY[b.entidad_tipo ?? ""] ?? 99;
        if (pa !== pb) return pa - pb;
        // La dirección solo invierte el orden por fecha; las alertas sin fecha
        // quedan siempre al final del bloque en ambos sentidos.
        const fa = a.fecha_vencimiento;
        const fb = b.fecha_vencimiento;
        if (fa && fb) return fa < fb ? -dir : fa > fb ? dir : 0;
        if (fa) return -1;
        if (fb) return 1;
        return 0;
      });
    }
    return map;
  }, [filtered, orden]);

  function handleMarcarVista(id: string) {
    setPendingId(id);
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      await marcarAlertaVista(id);
      setPendingId((curr) => (curr === id ? null : curr));
      router.refresh();
    });
  }

  const sevCounts: Record<Severidad, number> = {
    critica: alertas.filter((a) => a.severidad === "critica").length,
    advertencia: alertas.filter((a) => a.severidad === "advertencia").length,
    info: alertas.filter((a) => a.severidad === "info").length,
  };
  const urgentesCount = alertas.filter(esUrgente).length;

  const catCounts: Record<AlertaCategoria, number> = {
    documentacion: 0,
    cheques: 0,
    viajes: 0,
    personal: 0,
    sistema: 0,
  };
  for (const a of alertas) catCounts[categoriaDeAlerta(a.tipo, a.entidad_tipo)]++;

  const totalFiltered = filtered.length;
  const hasAnyAlertas = alertas.length > 0;
  const hayFiltroActivo = sevFilter !== "todas" || catFilter !== "todas" || urgentesOnly || query.trim() !== "";

  function limpiarFiltros() {
    setSevFilter("todas");
    setCatFilter("todas");
    setUrgentesOnly(false);
    setQuery("");
  }

  // Al filtrar por una severidad desde el panel, esa sección se muestra sí o sí.
  function toggleSevFilter(sev: Severidad) {
    setUrgentesOnly(false);
    setSevFilter((curr) => (curr === sev ? "todas" : sev));
  }

  return (
    <div className="space-y-5">
      {/* Panel de resumen: pantallazo + filtro rápido por severidad */}
      {hasAnyAlertas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <ResumenCard
            label="Total activas"
            value={alertas.length}
            tone="total"
            active={sevFilter === "todas" && !urgentesOnly}
            onClick={() => {
              setSevFilter("todas");
              setUrgentesOnly(false);
            }}
          />
          <ResumenCard
            label="Vencen hoy / vencidas"
            value={urgentesCount}
            tone="urgente"
            active={urgentesOnly}
            onClick={() => {
              setUrgentesOnly((v) => !v);
              setSevFilter("todas");
            }}
          />
          {SEVERIDAD_ORDER.map((s) => (
            <ResumenCard
              key={s}
              label={SEVERIDAD_LABEL[s]}
              value={sevCounts[s]}
              tone={s}
              active={sevFilter === s}
              onClick={() => toggleSevFilter(s)}
            />
          ))}
        </div>
      )}

      {/* Barra de filtros secundaria: búsqueda + categorías (siempre visibles) */}
      {hasAnyAlertas && (
        <div className="bg-card rounded-[8px] border border-border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en título o mensaje..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
              />
            </div>
            <button
              type="button"
              onClick={() => setOrden((o) => (o === "asc" ? "desc" : "asc"))}
              title={
                orden === "asc"
                  ? "Ordenado por fecha: más próximas primero (clic para invertir)"
                  : "Ordenado por fecha: más lejanas primero (clic para invertir)"
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-primary hover:border-[#0088D1] transition-colors shrink-0 whitespace-nowrap"
            >
              {orden === "asc" ? (
                <ArrowUpNarrowWide size={14} />
              ) : (
                <ArrowDownNarrowWide size={14} />
              )}
              {orden === "asc" ? "Más próximas" : "Más lejanas"}
            </button>
            {hayFiltroActivo && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-xs text-primary hover:underline whitespace-nowrap px-1"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1 border-t border-border/60">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mr-0.5">
              <SlidersHorizontal size={12} />
              Categoría
            </span>
            <FilterChip
              label={`Todas (${alertas.length})`}
              active={catFilter === "todas"}
              onClick={() => setCatFilter("todas")}
            />
            {(Object.keys(CATEGORIA_LABEL) as AlertaCategoria[]).map((c) => (
              <FilterChip
                key={c}
                label={`${CATEGORIA_LABEL[c]} (${catCounts[c]})`}
                active={catFilter === c}
                onClick={() => setCatFilter(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lista agrupada */}
      <div id="listado-alertas" className="space-y-4 scroll-mt-20">
        {!hasAnyAlertas ? (
          <div className="bg-card rounded-[8px] border border-border shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#ECFDF5] mb-4">
                <CheckCircle2 size={24} className="text-[#22C55E]" />
              </div>
              <p className="text-foreground text-sm font-medium mb-1">Todo en orden</p>
              <p className="text-muted-foreground/70 text-sm">El sistema no detectó alertas activas</p>
            </div>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="bg-card rounded-[8px] border border-border shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-sm font-medium mb-1">Sin coincidencias</p>
              <p className="text-muted-foreground/70 text-sm mb-3">Probá ajustar los filtros</p>
              {hayFiltroActivo && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          SEVERIDAD_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            // Si el filtro apunta a esta severidad, se muestra expandida sí o sí.
            const isCollapsed = collapsed[sev] && sevFilter !== sev;
            const accent = SEV_ACCENT[sev];
            const segments = segmentarPorBloque(items);
            const showHeaders = segments.length > 1;
            return (
              <div
                key={sev}
                id={`sev-${sev}`}
                className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden scroll-mt-24"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [sev]: !prev[sev] }))
                  }
                  className={`w-full flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-muted/40 ${
                    !isCollapsed ? "border-b border-border" : ""
                  }`}
                >
                  {isCollapsed ? (
                    <ChevronRight size={15} className="text-muted-foreground/70" />
                  ) : (
                    <ChevronDown size={15} className="text-muted-foreground/70" />
                  )}
                  <span className={`size-2 rounded-full ${accent.dot}`} aria-hidden />
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider ${accent.label}`}>
                    {SEVERIDAD_LABEL[sev]}
                  </span>
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {items.length} {items.length === 1 ? "alerta" : "alertas"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-border/60">
                    {segments.map((seg) => (
                      <BloqueSeccion
                        key={seg.bloque}
                        bloque={seg.bloque}
                        items={seg.items}
                        showHeader={showHeaders}
                        pendingId={pendingId}
                        onMarcarVista={handleMarcarVista}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Empty states por categoría (cuando no hay alertas en alguna) */}
      {hasAnyAlertas && catFilter === "todas" && sevFilter === "todas" && !urgentesOnly && !query && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(CATEGORIA_LABEL) as AlertaCategoria[])
            .filter((c) => catCounts[c] === 0)
            .map((c) => {
              const Icon = CATEGORIA_ICON[c];
              return (
                <div
                  key={c}
                  className="bg-card rounded-[8px] border border-dashed border-border p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-muted-foreground/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {CATEGORIA_LABEL[c]}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {CATEGORIA_EMPTY_MSG[c]}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Historial de notificaciones leídas (se guardan; el usuario las borra cuando quiere) */}
      <HistorialLeidas leidas={leidas} />
    </div>
  );
}

// Tarjetas de resumen sobrias: fondo de tarjeta normal, el color va solo en el
// punto y en el número (los fondos pastel llenaban la pantalla de colores).
const RESUMEN_TONE: Record<
  "total" | "urgente" | Severidad,
  { ring: string; value: string; dot: string }
> = {
  total: { ring: "ring-[#0088D1]/50", value: "text-foreground", dot: "bg-[#64748B]" },
  urgente: { ring: "ring-[#EF4444]/50", value: "text-[#DC2626]", dot: "bg-[#EF4444]" },
  critica: { ring: "ring-[#EF4444]/50", value: "text-[#DC2626]", dot: "bg-[#EF4444]" },
  advertencia: { ring: "ring-[#F59E0B]/50", value: "text-[#D97706]", dot: "bg-[#F59E0B]" },
  info: { ring: "ring-[#0088D1]/50", value: "text-[#0369A1]", dot: "bg-[#0088D1]" },
};

function ResumenCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "total" | "urgente" | Severidad;
  active: boolean;
  onClick: () => void;
}) {
  const styles = RESUMEN_TONE[tone];
  const dimmed = value === 0 && tone !== "total";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative overflow-hidden rounded-[8px] border bg-card px-3.5 py-3 text-left transition-all hover:shadow-sm ${
        active
          ? `ring-2 ring-offset-1 ring-offset-background border-transparent ${styles.ring}`
          : "border-border hover:border-border/80"
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        {tone === "urgente" ? (
          <Flame size={12} className="text-[#EF4444]" />
        ) : (
          <span className={`size-2 rounded-full ${styles.dot}`} />
        )}
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80 leading-tight">
          {label}
        </span>
      </div>
      <p className={`mt-1 text-2xl font-black tracking-tight leading-none ${styles.value}`}>
        {value}
      </p>
    </button>
  );
}

function BloqueSeccion({
  bloque,
  items,
  showHeader,
  pendingId,
  onMarcarVista,
}: {
  bloque: BloqueId;
  items: AlertaItem[];
  showHeader: boolean;
  pendingId: string | null;
  onMarcarVista: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const visibles = expandido ? items : items.slice(0, LIMITE_BLOQUE);
  const restantes = items.length - visibles.length;

  return (
    <div>
      {showHeader && <BloqueHeader bloque={bloque} count={items.length} />}
      <div className="divide-y divide-border/60">
        {visibles.map((alerta) => (
          <AlertaRow
            key={alerta.id}
            alerta={alerta}
            pending={pendingId === alerta.id}
            onMarcarVista={onMarcarVista}
          />
        ))}
      </div>
      {(restantes > 0 || expandido) && items.length > LIMITE_BLOQUE && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="w-full flex items-center justify-center gap-1 px-5 py-2 text-xs font-semibold text-primary hover:bg-[#F0F9FF]/60 transition-colors border-t border-[#F1F5F9]"
        >
          {expandido ? (
            <>
              <ChevronDown size={13} className="rotate-180" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown size={13} />
              Ver {restantes} más
            </>
          )}
        </button>
      )}
    </div>
  );
}

function BloqueHeader({ bloque, count }: { bloque: BloqueId; count: number }) {
  const meta = BLOQUE_META[bloque];
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-muted/20">
      <span className="text-[13px] leading-none">{meta.emoji}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {meta.label}
      </span>
      <span className="text-[11px] font-bold text-muted-foreground/50">{count}</span>
    </div>
  );
}

function HistorialLeidas({ leidas }: { leidas: AlertaItem[] }) {
  const router = useRouter();
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [borrandoTodas, setBorrandoTodas] = useState(false);
  const [, startTransition] = useTransition();

  // Lista derivada de las props (sin efecto): el server es la fuente de verdad
  // tras cada refresh; acá solo ocultamos al instante lo que se está borrando.
  const items = borrandoTodas ? [] : leidas.filter((a) => !removidos.has(a.id));

  if (items.length === 0) return null;

  function handleBorrar(id: string) {
    setRemovidos((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await borrarAlerta(id);
      router.refresh();
    });
  }

  function handleBorrarTodas() {
    setBorrandoTodas(true);
    startTransition(async () => {
      await borrarTodasLeidas();
      router.refresh();
    });
  }

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 min-w-0"
        >
          {open ? (
            <ChevronDown size={16} className="text-muted-foreground/70" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground/70" />
          )}
          <History size={15} className="text-muted-foreground/70" />
          <span className="text-sm font-semibold text-foreground">Leídas</span>
          <span className="text-xs font-bold text-muted-foreground/80">{items.length}</span>
        </button>
        <button
          type="button"
          onClick={handleBorrarTodas}
          disabled={borrandoTodas}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-all shrink-0 disabled:opacity-40"
        >
          <Trash2 size={13} />
          Borrar leídas
        </button>
      </div>
      {open && (
        <div className="divide-y divide-border/60">
          {items.map((alerta) => {
            const href = alertaHref(alerta);
            return (
              <div
                key={alerta.id}
                className="group flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {href ? (
                    <Link
                      href={href}
                      className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                    >
                      {alerta.titulo}
                      <ExternalLink size={11} className="opacity-40" />
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">{alerta.titulo}</span>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{alerta.mensaje}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleBorrar(alerta.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/70 border border-transparent hover:text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-all shrink-0 disabled:opacity-30"
                  aria-label="Borrar notificación"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "error" | "warning" | "info";
}) {
  const toneCls =
    active && tone === "error"
      ? "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"
      : active && tone === "warning"
        ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
        : active && tone === "info"
          ? "bg-[#F0F9FF] border-[#B3E5FC] text-[#075985]"
          : active
            ? "bg-[#0088D1] border-[#0088D1] text-white"
            : "bg-card border-border text-muted-foreground hover:border-[#0088D1] hover:text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${toneCls}`}
    >
      {label}
    </button>
  );
}

function AlertaRow({
  alerta,
  pending,
  onMarcarVista,
}: {
  alerta: AlertaItem;
  pending: boolean;
  onMarcarVista: (id: string) => void;
}) {
  const href = alertaHref(alerta);
  const dias = diasRestantes(alerta.fecha_vencimiento);
  const esCumple = alerta.tipo === "otro" && (alerta.entidad_tipo === "choferes_cumple" || alerta.entidad_tipo === "personal_cumple");
  const esPrueba = alerta.tipo === "otro" && alerta.entidad_tipo === "choferes_periodo_prueba";
  const esAniversario = alerta.tipo === "otro" && (alerta.entidad_tipo === "choferes_aniversario" || alerta.entidad_tipo === "personal_aniversario");

  const fechaVencFmt = alerta.fecha_vencimiento
    ? (() => {
        const parts = alerta.fecha_vencimiento.split("-");
        return parts.length === 3
          ? `${parts[2]}/${parts[1]}/${parts[0]}`
          : new Date(alerta.fecha_vencimiento).toLocaleDateString("es-AR");
      })()
    : null;

  // La fecha exacta se muestra como tooltip del chip para no gastar una línea.
  const fechaTitle = fechaVencFmt
    ? `${esCumple ? "Cumpleaños" : esPrueba ? "Fin de prueba" : esAniversario ? "Aniversario" : "Vence"} el ${fechaVencFmt}`
    : undefined;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {dias !== null && (
            <span title={fechaTitle} className="shrink-0">
              <DiasChip dias={dias} esCumple={esCumple} esPrueba={esPrueba} esAniversario={esAniversario} />
            </span>
          )}
          {href ? (
            <Link
              href={href}
              title={alerta.titulo}
              className="text-foreground text-sm font-semibold hover:text-primary transition-colors inline-flex items-center gap-1 min-w-0"
            >
              <span className="truncate">{alerta.titulo}</span>
              <ExternalLink size={11} className="opacity-40 shrink-0" />
            </Link>
          ) : (
            <span className="text-foreground text-sm font-semibold truncate">{alerta.titulo}</span>
          )}
        </div>
        <p className="text-muted-foreground/70 text-xs mt-0.5 truncate">{alerta.mensaje}</p>
      </div>
      {alerta.marcable === false ? (
        href ? (
          <Link
            href={href}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold text-primary border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E1F5FE] transition-colors shrink-0"
          >
            Actualizar
            <ChevronRight size={13} />
          </Link>
        ) : null
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => onMarcarVista(alerta.id)}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:text-primary hover:border-[#BAE6FD] hover:bg-[#E1F5FE] transition-all shrink-0 disabled:opacity-30"
          aria-label="Marcar como leída"
        >
          <Check size={13} />
          Leída
        </button>
      )}
    </div>
  );
}

function DiasChip({ dias, esCumple, esPrueba, esAniversario }: { dias: number; esCumple?: boolean; esPrueba?: boolean; esAniversario?: boolean }) {
  const tone = chipToneFromDias(dias, esCumple, esPrueba, esAniversario);
  let label = chipLabelFromDias(dias);
  if (esCumple) {
    if (dias === 0) label = "Cumpleaños hoy 🎂";
    else if (dias === 1) label = "Mañana 🎂";
    else label = `En ${dias} días 🎂`;
  } else if (esAniversario) {
    if (dias === 0) label = "Aniversario hoy 🎉";
    else if (dias === 1) label = "Mañana 🎉";
    else label = `En ${dias} días 🎉`;
  } else if (esPrueba) {
    label = `Prueba: ${dias}d ⏳`;
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {label}
    </span>
  );
}
