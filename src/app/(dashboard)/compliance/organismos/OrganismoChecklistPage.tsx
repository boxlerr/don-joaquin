"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  FileX,
  Clock,
  Upload,
  ExternalLink,
  CalendarClock,
  User,
  Pencil,
  MessageSquare,
  Send,
  Plus,
  Download,
  Trash2,
  ClipboardList,
} from "lucide-react";
import type {
  ComplianceDestinatario,
  ComplianceEstado,
  OrganismoChecklistRow,
} from "../types";
import { getSignedUrlComplianceArchivoAction } from "../actions";
import CargarOrganismoDocDialog from "./CargarOrganismoDocDialog";
import RequisitoOrganismoDialog, { type RequisitoEditable } from "./RequisitoOrganismoDialog";
import { eliminarRequisitoOrganismoAction } from "./actions";
import ComplianceHelpButton from "../components/ComplianceHelpButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { exportarOrganismoXlsx } from "./export";
import { formatFecha } from "@/lib/utils";

interface Props {
  destinatario: ComplianceDestinatario;
  rows: OrganismoChecklistRow[];
  canWrite: boolean;
  /** Cuando es true, omite el padding lateral del root (lo asume el wrapper). */
  embedded?: boolean;
}

const ESTADO_TONE: Record<ComplianceEstado, "success" | "warning" | "error" | "neutral"> = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "error",
  faltante: "neutral",
};

const ESTADO_LABEL: Record<ComplianceEstado, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  faltante: "Falta",
};

export default function OrganismoChecklistPage({ destinatario, rows, canWrite, embedded = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogState, setDialogState] = useState<{
    row: OrganismoChecklistRow;
    edit: boolean;
  } | null>(null);
  // `null` = cerrado; `{edit: null}` = alta; `{edit: row}` = edición.
  const [reqDialog, setReqDialog] = useState<{ edit: RequisitoEditable | null } | null>(null);
  const [aEliminar, setAEliminar] = useState<OrganismoChecklistRow | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const slug = destinatario.codigo.toLowerCase();

  const refrescar = () => startTransition(() => router.refresh());

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setBorrando(true);
    try {
      const res = await eliminarRequisitoOrganismoAction({
        id: aEliminar.requisito_id,
        destinatario_slug: slug,
      });
      if ("error" in res && res.error) alert(res.error);
      setAEliminar(null);
      refrescar();
    } finally {
      setBorrando(false);
    }
  };

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarOrganismoXlsx(destinatario.nombre, rows);
    } finally {
      setExportando(false);
    }
  };

  const resumen = rows.reduce<Record<ComplianceEstado, number>>(
    (acc, r) => { acc[r.estado] += 1; return acc; },
    { vigente: 0, por_vencer: 0, vencido: 0, faltante: 0 },
  );

  const abrirSignedUrl = async (archivo_id: string) => {
    const res = await getSignedUrlComplianceArchivoAction(archivo_id);
    if ("url" in res && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else alert(res.error ?? "No se pudo abrir el archivo");
  };

  const handleUpload = (row: OrganismoChecklistRow) => setDialogState({ row, edit: false });
  const handleEdit = (row: OrganismoChecklistRow) => setDialogState({ row, edit: true });

  return (
    <div className={embedded ? "space-y-6" : "p-4 sm:p-6 lg:p-8 space-y-6"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Compliance — Organismo previo
          </p>
          <h1 className="text-lg sm:text-xl font-bold">{destinatario.nombre}</h1>
          {destinatario.descripcion && (
            <p className="text-sm text-muted-foreground mt-0.5">{destinatario.descripcion}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportar} disabled={exportando} className="gap-1.5">
              <Download size={14} />
              {exportando ? "Generando…" : "Exportar"}
            </Button>
          )}
          {canWrite && (
            <Button size="sm" variant="brand" onClick={() => setReqDialog({ edit: null })} className="gap-1.5">
              <Plus size={14} />
              Nuevo requisito
            </Button>
          )}
          <ComplianceHelpButton />
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {(["vencido", "por_vencer", "faltante", "vigente"] as ComplianceEstado[]).map((e) => (
          <div key={e} className="bg-card border border-border rounded-[8px] px-3 py-3 sm:px-4 text-center shadow-sm">
            <p className="text-xl sm:text-2xl font-black">{resumen[e]}</p>
            <StatusBadge label={ESTADO_LABEL[e]} tone={ESTADO_TONE[e]} />
          </div>
        ))}
      </div>

      {/* Lista de requisitos */}
      {rows.length === 0 ? (
        /* El estado vacío antes mandaba a "agregar requisitos desde la base de
           datos", que es una pared para quien usa el sistema. Ahora es el lugar
           desde donde se arranca. */
        <div className="bg-card border border-dashed border-border rounded-[8px] px-6 py-10 text-center">
          <ClipboardList size={28} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">
            Todavía no cargaste qué se presenta ante {destinatario.nombre}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Cargá cada trámite o documento que haya que presentar. Después vas registrando las
            presentaciones con su vencimiento, y el sistema avisa solo cuando se acerca.
          </p>
          {canWrite && (
            <Button
              variant="brand"
              onClick={() => setReqDialog({ edit: null })}
              className="mt-4 gap-1.5"
            >
              <Plus size={15} />
              Cargar el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[8px] shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <RequisitoPresentacionRow
                key={row.requisito_id}
                row={row}
                canWrite={canWrite}
                onUpload={() => handleUpload(row)}
                onEdit={() => handleEdit(row)}
                onOpenFile={abrirSignedUrl}
                onEditarRequisito={() => setReqDialog({ edit: row })}
                onEliminarRequisito={() => setAEliminar(row)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dialog de carga / edición */}
      {dialogState && (
        <CargarOrganismoDocDialog
          destinatario={destinatario}
          row={dialogState.row}
          edit={dialogState.edit}
          onClose={() => {
            setDialogState(null);
            refrescar();
          }}
        />
      )}

      {/* Alta y edición del requisito en sí (qué hay que presentar) */}
      {reqDialog && (
        <RequisitoOrganismoDialog
          destinatario={destinatario}
          edit={reqDialog.edit}
          open
          onOpenChange={(v) => !v && setReqDialog(null)}
          onSuccess={() => {
            setReqDialog(null);
            refrescar();
          }}
        />
      )}

      {/* Baja del requisito. El texto cambia según haya presentaciones o no:
          con historial se desactiva, sin historial se borra de verdad. */}
      {aEliminar && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setAEliminar(null)}
          title={`¿Dar de baja "${aEliminar.requisito_nombre}"?`}
          description={
            aEliminar.documento_id
              ? "Tiene presentaciones cargadas, así que se archiva: deja de pedirse y de aparecer en las alertas, pero el historial y los archivos quedan guardados."
              : "No tiene ninguna presentación cargada, así que se elimina. No se puede deshacer."
          }
          confirmLabel={aEliminar.documento_id ? "Dar de baja" : "Eliminar"}
          loading={borrando}
          onConfirm={confirmarEliminar}
        />
      )}
    </div>
  );
}

function RequisitoPresentacionRow({
  row,
  canWrite,
  onUpload,
  onEdit,
  onOpenFile,
  onEditarRequisito,
  onEliminarRequisito,
}: {
  row: OrganismoChecklistRow;
  canWrite: boolean;
  onUpload: () => void;
  onEdit: () => void;
  onOpenFile: (id: string) => void;
  onEditarRequisito: () => void;
  onEliminarRequisito: () => void;
}) {
  const faltante = row.estado === "faltante";
  const vencido = row.estado === "vencido";
  const porVencer = row.estado === "por_vencer";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-muted/20 transition-colors">
      {/* Ícono de estado + información (en celular las acciones bajan solas) */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <div className="shrink-0 mt-0.5 sm:mt-0">
          {faltante ? (
            <FileX size={18} className="text-muted-foreground/50" />
          ) : vencido ? (
            <AlertTriangle size={18} className="text-[#EF4444]" />
          ) : porVencer ? (
            <Clock size={18} className="text-[#F59E0B]" />
          ) : (
            <CheckCircle2 size={18} className="text-[#22C55E]" />
          )}
        </div>

        {/* Información */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{row.requisito_nombre}</span>
            <StatusBadge label={ESTADO_LABEL[row.estado]} tone={ESTADO_TONE[row.estado]} />
            {row.dias_restantes !== null && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                vencido
                  ? "bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]"
                  : porVencer
                  ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                  : "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
              }`}>
                {vencido
                  ? `Vencido ${Math.abs(row.dias_restantes)}d`
                  : `${row.dias_restantes}d`}
              </span>
            )}
          </div>

          {/* A dónde se manda (portal/mail) — visible siempre, aunque no haya presentación */}
          {row.enviar_a && (
            <p
              className="text-[11px] text-[#075985] mt-1 inline-flex items-center gap-1"
              title={`Se manda a: ${row.enviar_a}`}
            >
              <Send size={11} className="shrink-0" />
              Se manda a: {row.enviar_a}
            </p>
          )}

          {/* Detalle de la última presentación */}
          {row.documento_id ? (
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {row.fecha_emision && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <CalendarClock size={11} />
                  Presentado el {formatFecha(row.fecha_emision)}
                </span>
              )}
              {row.presentado_por_nombre && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <User size={11} />
                  {row.presentado_por_nombre}
                </span>
              )}
              {row.fecha_vencimiento && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Clock size={11} />
                  Vence {formatFecha(row.fecha_vencimiento)}
                </span>
              )}
              {row.observaciones && (
                <span className="text-[11px] text-muted-foreground/80 italic inline-flex items-center gap-1">
                  <MessageSquare size={11} />
                  {row.observaciones}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/60 mt-1">Sin presentación registrada</p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 max-sm:pl-[30px]">
        {row.archivo_id && (
          <button
            type="button"
            onClick={() => onOpenFile(row.archivo_id!)}
            className="flex items-center gap-1 px-2.5 py-1.5 max-md:h-9 max-md:px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-primary hover:border-[#BAE6FD] hover:bg-[#F0F9FF] transition-colors"
          >
            <ExternalLink size={12} />
            Ver
          </button>
        )}
        {canWrite && row.documento_id && (
          <button
            type="button"
            onClick={onEdit}
            title="Editar vencimiento (sin re-subir archivo)"
            className="flex items-center gap-1 px-2.5 py-1.5 max-md:h-9 max-md:px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-primary hover:border-[#BAE6FD] hover:bg-[#F0F9FF] transition-colors"
          >
            <Pencil size={12} />
            Editar venc.
          </button>
        )}
        {canWrite && (
          <Button size="sm" variant="outline" onClick={onUpload} className="gap-1.5 text-xs">
            <Upload size={13} />
            {row.documento_id ? "Actualizar" : "Cargar"}
          </Button>
        )}
        {canWrite && (
          <>
            {/* Editar el REQUISITO (cómo se llama, cuándo avisa) es otra cosa que
                editar la presentación: por eso el ícono va aparte y con su título. */}
            <button
              type="button"
              onClick={onEditarRequisito}
              title="Editar el requisito"
              aria-label={`Editar el requisito ${row.requisito_nombre}`}
              className="flex h-8 w-8 max-md:h-9 max-md:w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[#BAE6FD] hover:bg-[#F0F9FF] hover:text-primary"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={onEliminarRequisito}
              title="Dar de baja el requisito"
              aria-label={`Dar de baja el requisito ${row.requisito_nombre}`}
              className="flex h-8 w-8 max-md:h-9 max-md:w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[#FCA5A5] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
