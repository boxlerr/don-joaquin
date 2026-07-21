"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, FileCheck2, ClipboardList, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import ComplianceChecklistPage from "./components/ComplianceChecklistPage";
import OrganismoChecklistPage from "./organismos/OrganismoChecklistPage";
import Form931Client from "./form-931/Form931Client";
import type {
  ComplianceDestinatario,
  ComplianceEstado,
  ComplianceEstadoRow,
  ComplianceRequisito,
  OrganismoChecklistRow,
  UnidadInfo,
} from "./types";
import type { Form931Row } from "./form-931/actions";

type ClienteData = {
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  unidades: Record<string, UnidadInfo>;
};
type OrganismoData = {
  destinatario: ComplianceDestinatario;
  rows: OrganismoChecklistRow[];
  canWrite: boolean;
};

interface Props {
  canWrite: boolean;
  /** Papeleta combinada de YPF + Loma (los específicos van marcados "(solo X)"). */
  documentacion: ClienteData;
  organismos: OrganismoData[];
  periodos931: Form931Row[];
  /** A dónde se presenta el 931 (SICOP, Secondi, portal YPF…) — parámetro editable. */
  envio931: string | null;
  /** Plataforma inicial (de ?plat=) para deep-links desde rutas viejas. */
  initialPlat?: string;
}

function esPendiente(estado: ComplianceEstado): boolean {
  return estado === "vencido" || estado === "por_vencer" || estado === "faltante";
}

function diasRestantes(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

type TabDef = {
  id: string;
  label: string;
  icon: typeof ShieldCheck;
  alerta: number;
  render: () => React.ReactNode;
};

/**
 * Compliance unificado — una sola pantalla (reunión Nico §9). Solapa
 * "Documentación" en formato checklist (YPF + Loma juntos, específicos marcados
 * entre paréntesis) + SICOP + Secondi + Formulario 931.
 */
export default function ComplianceUnifiedClient({
  canWrite,
  documentacion,
  organismos,
  periodos931,
  envio931,
  initialPlat,
}: Props) {
  // El F931 vive dentro de la papeleta (fila "F931" de Empresa): ahí se despliega
  // el seguimiento de períodos con su fecha límite y el envío a YPF/Loma. Antes era
  // una solapa aparte y quedaba duplicado con el ítem de Documentación.
  const pendientes931 = periodos931.filter((p) => !(p.enviado_ypf && p.enviado_loma)).length;

  const tabs = useMemo<TabDef[]>(() => {
    const out: TabDef[] = [];

    out.push({
      id: "documentacion",
      label: "Documentación",
      icon: ClipboardList,
      alerta:
        documentacion.rows.filter((r) => esPendiente(r.estado)).length + pendientes931,
      render: () => (
        <ComplianceChecklistPage
          titulo="Documentación"
          subtitulo="Checklist de la papeleta de flota (YPF y Loma). Los que van a todas las plataformas no llevan nada; los específicos van marcados (solo YPF) / (solo Loma)."
          rows={documentacion.rows}
          requisitos={documentacion.requisitos}
          unidades={documentacion.unidades}
          canWrite={canWrite}
          embedded
          panelInicial={initialPlat?.toLowerCase() === "931" ? "F931" : undefined}
          renderRowPanel={(row) =>
            row.requisito_codigo === "F931" ? (
              <Form931Panel periodos={periodos931} envio931={envio931} canWrite={canWrite} />
            ) : null
          }
        />
      ),
    });

    for (const org of organismos) {
      out.push({
        id: `org:${org.destinatario.codigo.toLowerCase()}`,
        label: org.destinatario.nombre,
        icon: ShieldCheck,
        alerta: org.rows.filter((r) => esPendiente(r.estado)).length,
        render: () => (
          <OrganismoChecklistPage
            destinatario={org.destinatario}
            rows={org.rows}
            canWrite={org.canWrite}
            embedded
          />
        ),
      });
    }

    return out;
  }, [documentacion, organismos, periodos931, pendientes931, envio931, canWrite, initialPlat]);

  // Resolver la solapa inicial (?plat=). Las rutas viejas (ypf/loma/generales)
  // caen todas en "Documentación", que ahora las junta.
  const resolveInitial = (): string => {
    if (!initialPlat) return tabs[0]?.id ?? "documentacion";
    const p = initialPlat.toLowerCase();
    // "931" también cae acá: dejó de ser solapa y ahora es una fila de la papeleta
    // (se abre desplegada vía `panelInicial`).
    if (["ypf", "loma", "generales", "documentacion", "docs", "931"].includes(p))
      return "documentacion";
    const direct = tabs.find((t) => t.id === p);
    if (direct) return direct.id;
    const org = tabs.find((t) => t.id === `org:${p}`);
    if (org) return org.id;
    return tabs[0]?.id ?? "documentacion";
  };

  const [activo, setActivo] = useState<string>(resolveInitial);
  const tab = tabs.find((t) => t.id === activo) ?? tabs[0];

  return (
    <div className="p-6 sm:p-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          Compliance
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Toda la documentación y las presentaciones en un solo lugar — checklist con fechas de
          vencimiento y alertas.
        </p>
      </div>

      {/* Selector */}
      <div className="flex items-center gap-1 border-b border-border -mx-6 sm:-mx-8 px-6 sm:px-8 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab?.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActivo(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                active
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon size={15} />
              {t.label}
              {t.alerta > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    active ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.alerta}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab?.render()}
    </div>
  );
}

/**
 * Panel del Formulario 931 — se despliega dentro de la fila "F931" de la papeleta.
 * Lleva el aviso de que es bloqueante, a dónde se presenta, el resumen y la tabla
 * de períodos (fecha límite editable + envío a YPF/Loma).
 */
function Form931Panel({
  periodos,
  envio931,
  canWrite,
}: {
  periodos: Form931Row[];
  envio931: string | null;
  canWrite: boolean;
}) {
  const completo = (p: Form931Row) => p.enviado_ypf && p.enviado_loma;
  const completos = periodos.filter(completo).length;
  const pendientes = periodos.filter((p) => !completo(p));
  const vencidos = pendientes.filter((p) => diasRestantes(p.fecha_limite) < 0).length;
  const porVencer = pendientes.filter((p) => {
    const d = diasRestantes(p.fecha_limite);
    return d >= 0 && d <= 7;
  }).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">El F931 es bloqueante: sin presentarlo, no puede cargar nadie.</p>
          <p className="text-xs mt-0.5 text-amber-700">
            Cada mes hay que enviarlo a las dos plataformas: <strong>Nico lo manda a YPF</strong> y{" "}
            <strong>Noelia a Loma Negra</strong>. Marcá cada envío al hacerlo. Si llega la fecha límite
            sin enviarse, salta alerta a todos (campana + email de Compliance).
          </p>
          {envio931 && (
            <p className="text-xs mt-1 text-amber-800">
              <strong>Se presenta en:</strong> {envio931}.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ResumenChip icon={FileCheck2} label="períodos" n={periodos.length} tone="brand" />
        <ResumenChip icon={CheckCircle2} label="completos" n={completos} tone="success" />
        <ResumenChip icon={Clock} label="por vencer" n={porVencer} tone="warning" />
        <ResumenChip icon={AlertTriangle} label="vencidos" n={vencidos} tone="error" />
      </div>

      <Form931Client periodos={periodos} canWrite={canWrite} />
    </div>
  );
}

/** Contador compacto del resumen del F931 (reemplaza a los StatCard, que anidados pesaban demasiado). */
function ResumenChip({
  icon: Icon,
  label,
  n,
  tone,
}: {
  icon: typeof FileCheck2;
  label: string;
  n: number;
  tone: "brand" | "success" | "warning" | "error";
}) {
  const cls = {
    brand: "bg-primary/5 text-primary border-primary/20",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    warning: "bg-amber-50 text-amber-700 border-amber-200/60",
    error: "bg-red-50 text-red-700 border-red-200/60",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls} ${
        n === 0 ? "opacity-50" : ""
      }`}
    >
      <Icon size={12} />
      <span className="tabular-nums">{n}</span>
      <span className="font-medium">{label}</span>
    </span>
  );
}
