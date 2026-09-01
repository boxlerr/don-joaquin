"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileCheck2,
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import ComplianceChecklistPage from "./components/ComplianceChecklistPage";
import ComplianceHelpButton from "./components/ComplianceHelpButton";
import TourCompliance, { BotonRecorrido } from "./components/TourCompliance";
import AgregarDocumentoDialog from "./components/AgregarDocumentoDialog";
import OrganismoChecklistPage from "./organismos/OrganismoChecklistPage";
import Form931Client from "./form-931/Form931Client";
import { exportarComplianceChecklistXlsx } from "./export";
import type {
  ChoferInfo,
  ComplianceDestinatario,
  ComplianceEstado,
  ComplianceEstadoRow,
  ComplianceRequisito,
  OrganismoChecklistRow,
  UnidadInfo,
} from "./types";
import type { Form931Row } from "./form-931/actions";
import { reconciliarF931 } from "./estado-931";

type ClienteData = {
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  unidades: Record<string, UnidadInfo>;
  choferes: Record<string, ChoferInfo>;
};
type OrganismoData = {
  destinatario: ComplianceDestinatario;
  rows: OrganismoChecklistRow[];
  canWrite: boolean;
};

interface Props {
  canWrite: boolean;
  /** Quién está mirando: el recorrido guiado se ofrece una vez por persona. */
  userId: string;
  /** Papeleta combinada de YPF + Loma (los específicos van marcados "(solo X)"). */
  documentacion: ClienteData;
  organismos: OrganismoData[];
  periodos931: Form931Row[];
  /** A dónde se presenta el 931 (SICOP, Secondi, portal YPF…) — parámetro editable. */
  envio931: string | null;
  /** Plataforma inicial (de ?plat=) para deep-links desde rutas viejas. */
  initialPlat?: string;
  /** Momento (ISO) en que el server armó estos datos. */
  generadoEn: string;
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
  /** Cuántos documentos tiene esa solapa (el número neutro del selector). */
  total: number;
  /** Cuántos están vencidos: es lo único que se pinta en rojo. */
  vencidos: number;
  /** Acciones propias de la solapa, en la cabecera de la pantalla. */
  acciones?: React.ReactNode;
  /** Qué es esa solapa. Va en el tooltip, no ocupando una franja de pantalla. */
  ayuda?: string;
  render: () => React.ReactNode;
};

/**
 * Compliance unificado — una sola pantalla (reunión Nico §9). Solapa
 * "Documentación" en formato checklist (YPF + Loma juntos, específicos marcados
 * entre paréntesis) + SICOP + Secondi + Formulario 931.
 */
export default function ComplianceUnifiedClient({
  canWrite,
  userId,
  documentacion,
  organismos,
  periodos931,
  envio931,
  initialPlat,
  generadoEn,
}: Props) {
  const router = useRouter();
  const [agregando, setAgregando] = useState(false);

  // El F931 vive dentro de la papeleta (fila "F931" de Empresa): ahí se despliega
  // el seguimiento de períodos con su fecha límite y el envío a YPF/Loma. Antes era
  // una solapa aparte y quedaba duplicado con el ítem de Documentación.
  const pendientes931 = periodos931.filter((p) => !(p.enviado_ypf && p.enviado_loma)).length;

  // La fila "F931" de la papeleta tiene que decir lo que dicen sus períodos.
  // Mientras no lo hizo, la pantalla mostraba "VENCIDOS 0 · Ninguno vencido" con
  // dos Formularios 931 sin presentar —uno de hacía 50 días— porque la papeleta
  // y la tabla de períodos son dos fuentes del mismo trámite y no se hablaban
  // (Julián, 01/09/2026). Ver `estado-931.ts`.
  const documentacionReal = useMemo(
    () => ({
      ...documentacion,
      rows: reconciliarF931(documentacion.rows, periodos931, generadoEn),
    }),
    [documentacion, periodos931, generadoEn],
  );

  const tabs = useMemo<TabDef[]>(() => {
    const out: TabDef[] = [];

    out.push({
      id: "documentacion",
      label: "Documentación",
      icon: ClipboardList,
      total: documentacionReal.rows.length,
      vencidos: documentacionReal.rows.filter((r) => r.estado === "vencido").length,
      acciones: (
        <>
          {/* Los dos botones de ayuda van juntos y marcados como uno: el último
              paso del recorrido los ilumina a la vez, porque lo que hay que
              recordar es el par —el recorrido y la guía con capturas—. */}
          <span data-tour="ayuda" className="inline-flex items-center gap-2">
            <BotonRecorrido />
            <ComplianceHelpButton />
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-border"
            title="Imprimir el checklist"
          >
            <Printer size={14} className="sm:mr-1.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportarComplianceChecklistXlsx("Documentación", documentacionReal.rows)}
            className="border-border"
          >
            <FileSpreadsheet size={14} className="mr-1.5" />
            Exportar
          </Button>
          {canWrite && (
            <Button variant="brand" size="sm" onClick={() => setAgregando(true)}>
              <Plus size={14} className="mr-1.5" />
              Agregar documento
            </Button>
          )}
        </>
      ),
      // La explicación de la papeleta (qué es y qué significan las marcas
      // "solo YPF" / "solo Loma") vive en el tooltip de la solapa y en el
      // Tutorial: como párrafo fijo se comía media pantalla todos los días.
      ayuda:
        "Papeleta de flota de YPF y Loma. Los documentos que van a las dos plataformas no llevan marca; los específicos van (solo YPF) o (solo Loma).",
      render: () => (
        <ComplianceChecklistPage
          titulo="Documentación"
          rows={documentacionReal.rows}
          requisitos={documentacionReal.requisitos}
          unidades={documentacionReal.unidades}
          choferes={documentacionReal.choferes}
          canWrite={canWrite}
          embedded
          generadoEn={generadoEn}
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
        total: org.rows.length,
        vencidos: org.rows.filter((r) => r.estado === "vencido").length,
        ayuda: org.destinatario.descripcion ?? undefined,
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
  }, [documentacionReal, organismos, periodos931, envio931, canWrite, initialPlat, generadoEn]);

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

  const pendientesDoc =
    documentacionReal.rows.filter((r) => esPendiente(r.estado)).length + pendientes931;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Header — título y acciones en UNA fila, sin bajada. Antes eran cinco
          bloques de texto apilados (título, bajada, botones, resumen y aviso)
          antes de llegar al primer dato: media pantalla en explicaciones. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 print:block">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          Compliance
        </h1>
        {tab?.acciones && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">{tab.acciones}</div>
        )}
      </div>

      {/* Selector — la tira se sale en celular: scroll propio con flechitas */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 print:hidden">
        <HorizontalScrollHint
          className="flex border-b border-border px-4 sm:px-6 lg:px-8"
          fadeBg="from-background"
        >
          <div className="flex items-center gap-1 w-max">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab?.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActivo(t.id)}
                  title={t.ayuda}
                  aria-label={
                    t.vencidos > 0
                      ? `${t.label}: ${t.total} documentos, ${t.vencidos} vencidos`
                      : `${t.label}: ${t.total} documentos`
                  }
                  className={`relative inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    active
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  {t.label}
                  {/* El total va en gris: 728 "sin cargar" no son una alarma. En
                      rojo va sólo lo vencido, que sí lo es. */}
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                      active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.total}
                  </span>
                  {t.vencidos > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#FEE2E2] text-[10px] font-bold tabular-nums text-[#991B1B]">
                      {t.vencidos}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </HorizontalScrollHint>
      </div>

      {/* Cuando no queda nada pendiente sí vale una línea: es la única que no
          se puede leer de las tarjetas (todas en cero se leen igual que "no
          cargué nada"). Con pendientes, los números de arriba ya lo dicen. */}
      {tab?.id === "documentacion" && pendientesDoc === 0 && (
        <p className="text-[13px] font-medium text-[#166534] print:hidden">
          Todo al día: los {documentacionReal.rows.length} documentos exigidos están presentados y vigentes.
        </p>
      )}

      {tab?.render()}

      <TourCompliance userId={userId} />

      {agregando && (
        <AgregarDocumentoDialog
          rows={documentacionReal.rows}
          requisitos={documentacionReal.requisitos}
          open={agregando}
          onOpenChange={setAgregando}
          onSuccess={() => {
            setAgregando(false);
            router.refresh();
          }}
        />
      )}
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
      <div className="flex items-start gap-2.5 sm:gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 sm:px-4 text-sm text-amber-800">
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
