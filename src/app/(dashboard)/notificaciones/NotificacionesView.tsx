"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  MapPin,
  Settings,
  ShieldAlert,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { marcarAlertaVista } from "./actions";
import {
  type AlertaCategoria,
  type AlertaItem,
  type Severidad,
  CATEGORIA_LABEL,
  SEVERIDAD_LABEL,
  SEVERIDAD_TONE,
  alertaHref,
  categoriaDeAlerta,
  chipLabelFromDias,
  chipToneFromDias,
  diasRestantes,
} from "./utils";

const SEVERIDAD_ORDER: Severidad[] = ["critica", "advertencia", "info"];

const SEV_ACCENT: Record<Severidad, { border: string; headerBg: string; count: string }> = {
  critica: {
    border: "border-l-[#EF4444]",
    headerBg: "bg-[#FEF2F2]/60 hover:bg-[#FEF2F2] dark:bg-red-950/20 dark:hover:bg-red-950/30",
    count: "text-[#DC2626] dark:text-red-300",
  },
  advertencia: {
    border: "border-l-[#F59E0B]",
    headerBg: "bg-[#FFFBEB]/60 hover:bg-[#FFFBEB] dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
    count: "text-[#D97706] dark:text-amber-300",
  },
  info: {
    border: "border-l-[#0088D1]",
    headerBg: "bg-[#F0F9FF]/60 hover:bg-[#F0F9FF] dark:bg-sky-950/20 dark:hover:bg-sky-950/30",
    count: "text-[#0369A1] dark:text-sky-300",
  },
};

const CATEGORIA_ICON: Record<AlertaCategoria, typeof ShieldAlert> = {
  documentacion: ShieldAlert,
  cheques: FileText,
  viajes: MapPin,
  sistema: Settings,
};

const CATEGORIA_EMPTY_MSG: Record<AlertaCategoria, string> = {
  documentacion: "No hay documentos próximos a vencer",
  cheques: "No hay cheques con alertas activas",
  viajes: "Sin viajes pendientes de cerrar ni viáticos sin rendir",
  sistema: "Sin eventos administrativos pendientes",
};

type SevFilter = Severidad | "todas";
type CatFilter = AlertaCategoria | "todas";

export default function NotificacionesView({
  alertas: initialAlertas,
}: {
  alertas: AlertaItem[];
}) {
  const router = useRouter();
  const [alertas, setAlertas] = useState(initialAlertas);
  const [sevFilter, setSevFilter] = useState<SevFilter>("todas");
  const [catFilter, setCatFilter] = useState<CatFilter>("todas");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<Severidad, boolean>>({
    critica: false,
    advertencia: false,
    info: true,
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alertas.filter((a) => {
      if (sevFilter !== "todas" && a.severidad !== sevFilter) return false;
      if (catFilter !== "todas" && categoriaDeAlerta(a.tipo) !== catFilter) return false;
      if (q && !a.titulo.toLowerCase().includes(q) && !a.mensaje.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [alertas, sevFilter, catFilter, query]);

  const grouped = useMemo(() => {
    const map: Record<Severidad, AlertaItem[]> = {
      critica: [],
      advertencia: [],
      info: [],
    };
    for (const a of filtered) map[a.severidad].push(a);
    return map;
  }, [filtered]);

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

  const catCounts: Record<AlertaCategoria, number> = {
    documentacion: 0,
    cheques: 0,
    viajes: 0,
    sistema: 0,
  };
  for (const a of alertas) catCounts[categoriaDeAlerta(a.tipo)]++;

  const totalFiltered = filtered.length;
  const hasAnyAlertas = alertas.length > 0;

  return (
    <div className="space-y-6">
      {/* Filtros rápidos */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1">
            Severidad
          </span>
          <FilterChip
            label={`Todas (${alertas.length})`}
            active={sevFilter === "todas"}
            onClick={() => setSevFilter("todas")}
          />
          {SEVERIDAD_ORDER.map((s) => (
            <FilterChip
              key={s}
              label={`${SEVERIDAD_LABEL[s]} (${sevCounts[s]})`}
              tone={SEVERIDAD_TONE[s]}
              active={sevFilter === s}
              onClick={() => setSevFilter(s)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1">
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
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en título o mensaje..."
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
          {(sevFilter !== "todas" || catFilter !== "todas" || query) && (
            <button
              type="button"
              onClick={() => {
                setSevFilter("todas");
                setCatFilter("todas");
                setQuery("");
              }}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista agrupada */}
      <div className="space-y-4">
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
              <p className="text-muted-foreground/70 text-sm">Probá ajustar los filtros</p>
            </div>
          </div>
        ) : (
          SEVERIDAD_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            const isCollapsed = collapsed[sev];
            const accent = SEV_ACCENT[sev];
            return (
              <div
                key={sev}
                className={`bg-card rounded-xl border border-border border-l-[3px] ${accent.border} shadow-sm overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [sev]: !prev[sev] }))
                  }
                  className={`w-full flex items-center justify-between px-5 py-3.5 border-b border-border transition-colors ${accent.headerBg}`}
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight size={16} className="text-muted-foreground/70" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground/70" />
                    )}
                    <StatusBadge
                      label={SEVERIDAD_LABEL[sev]}
                      tone={SEVERIDAD_TONE[sev]}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {items.length} {items.length === 1 ? "alerta" : "alertas"}
                    </span>
                  </div>
                  <span className={`text-lg font-black ${accent.count}`}>{items.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-[#F1F5F9] dark:divide-border">
                    {items.map((alerta) => (
                      <AlertaRow
                        key={alerta.id}
                        alerta={alerta}
                        pending={pendingId === alerta.id}
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
      {hasAnyAlertas && catFilter === "todas" && sevFilter === "todas" && !query && (
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
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${toneCls}`}
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
  const esCumple = alerta.tipo === "otro" && alerta.entidad_tipo === "choferes_cumple";
  const esPrueba = alerta.tipo === "otro" && alerta.entidad_tipo === "choferes_periodo_prueba";

  const fechaVencFmt = alerta.fecha_vencimiento
    ? (() => {
        const parts = alerta.fecha_vencimiento.split("-");
        return parts.length === 3
          ? `${parts[2]}/${parts[1]}/${parts[0]}`
          : new Date(alerta.fecha_vencimiento).toLocaleDateString("es-AR");
      })()
    : null;

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {dias !== null && (
            <DiasChip dias={dias} esCumple={esCumple} esPrueba={esPrueba} />
          )}
          {href ? (
            <Link
              href={href}
              className="text-foreground text-sm font-semibold hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              {alerta.titulo}
              <ExternalLink size={11} className="opacity-40" />
            </Link>
          ) : (
            <span className="text-foreground text-sm font-semibold">{alerta.titulo}</span>
          )}
        </div>
        <p className="text-muted-foreground text-xs mt-1">{alerta.mensaje}</p>
        {fechaVencFmt && (
          <p className="text-muted-foreground/60 text-[11px] mt-1 inline-flex items-center gap-1">
            <CalendarClock size={11} className="opacity-70" />
            {esCumple ? "Cumpleaños" : esPrueba ? "Fin de prueba" : "Vence"} el {fechaVencFmt}
          </p>
        )}
      </div>
      {alerta.marcable === false ? (
        href ? (
          <Link
            href={href}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold text-primary border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E1F5FE] dark:bg-sky-950/30 dark:border-sky-800/40 transition-colors shrink-0"
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
          Marcar leída
        </button>
      )}
    </div>
  );
}

function DiasChip({ dias, esCumple, esPrueba }: { dias: number; esCumple?: boolean; esPrueba?: boolean }) {
  const tone = chipToneFromDias(dias, esCumple, esPrueba);
  let label = chipLabelFromDias(dias);
  if (esCumple) {
    if (dias === 0) label = "Cumpleaños hoy 🎂";
    else if (dias === 1) label = "Mañana 🎂";
    else label = `En ${dias} días 🎂`;
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

