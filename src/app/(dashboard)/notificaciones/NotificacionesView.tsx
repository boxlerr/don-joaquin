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
      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mr-1">
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
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mr-1">
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
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-[#E2E8F0] bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
          />
          {(sevFilter !== "todas" || catFilter !== "todas" || query) && (
            <button
              type="button"
              onClick={() => {
                setSevFilter("todas");
                setCatFilter("todas");
                setQuery("");
              }}
              className="text-xs text-[#0088D1] hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista agrupada */}
      <div className="space-y-4">
        {!hasAnyAlertas ? (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#ECFDF5] mb-4">
                <CheckCircle2 size={24} className="text-[#22C55E]" />
              </div>
              <p className="text-[#0F172A] text-sm font-medium mb-1">Todo en orden</p>
              <p className="text-[#94A3B8] text-sm">El sistema no detectó alertas activas</p>
            </div>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-[#475569] text-sm font-medium mb-1">Sin coincidencias</p>
              <p className="text-[#94A3B8] text-sm">Probá ajustar los filtros</p>
            </div>
          </div>
        ) : (
          SEVERIDAD_ORDER.map((sev) => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            const isCollapsed = collapsed[sev];
            return (
              <div
                key={sev}
                className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [sev]: !prev[sev] }))
                  }
                  className="w-full flex items-center justify-between px-5 py-3.5 border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight size={16} className="text-[#94A3B8]" />
                    ) : (
                      <ChevronDown size={16} className="text-[#94A3B8]" />
                    )}
                    <StatusBadge
                      label={SEVERIDAD_LABEL[sev]}
                      tone={SEVERIDAD_TONE[sev]}
                    />
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {items.length} {items.length === 1 ? "alerta" : "alertas"}
                    </span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-[#F1F5F9]">
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
                  className="bg-white rounded-[8px] border border-dashed border-[#E2E8F0] p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-[#94A3B8]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#475569]">
                      {CATEGORIA_LABEL[c]}
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">
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
            : "bg-white border-[#E2E8F0] text-[#475569] hover:border-[#0088D1] hover:text-[#0088D1]";
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

  return (
    <div className="group flex items-start gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {dias !== null && (
            <DiasChip dias={dias} />
          )}
          {href ? (
            <Link
              href={href}
              className="text-[#0F172A] text-sm font-semibold hover:text-[#0088D1] hover:underline inline-flex items-center gap-1"
            >
              {alerta.titulo}
              <ExternalLink size={11} className="opacity-50" />
            </Link>
          ) : (
            <span className="text-[#0F172A] text-sm font-semibold">{alerta.titulo}</span>
          )}
        </div>
        <p className="text-[#475569] text-xs mt-1">{alerta.mensaje}</p>
        <p className="text-[#94A3B8] text-[11px] mt-1">
          Disparada: {new Date(alerta.fecha_disparo).toLocaleDateString("es-AR")}
          {alerta.fecha_vencimiento && (
            <>
              {" · Vence: "}
              {new Date(alerta.fecha_vencimiento).toLocaleDateString("es-AR")}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onMarcarVista(alerta.id)}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#475569] hover:text-[#0088D1] hover:bg-[#E1F5FE] transition-all shrink-0 disabled:opacity-30"
        aria-label="Marcar como leída"
      >
        <Check size={13} />
        Marcar leída
      </button>
    </div>
  );
}

function DiasChip({ dias }: { dias: number }) {
  const tone = chipToneFromDias(dias);
  const label = chipLabelFromDias(dias);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {label}
    </span>
  );
}

