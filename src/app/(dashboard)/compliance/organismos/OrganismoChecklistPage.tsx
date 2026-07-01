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
} from "lucide-react";
import type {
  ComplianceDestinatario,
  ComplianceEstado,
  OrganismoChecklistRow,
} from "../types";
import { getSignedUrlComplianceArchivoAction } from "../actions";
import CargarOrganismoDocDialog from "./CargarOrganismoDocDialog";
import ComplianceHelpButton from "../components/ComplianceHelpButton";
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
    <div className={embedded ? "space-y-6" : "p-8 space-y-6"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Compliance — Organismo previo
          </p>
          <h1 className="text-xl font-bold">{destinatario.nombre}</h1>
          {destinatario.descripcion && (
            <p className="text-sm text-muted-foreground mt-0.5">{destinatario.descripcion}</p>
          )}
        </div>
        <ComplianceHelpButton />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["vencido", "por_vencer", "faltante", "vigente"] as ComplianceEstado[]).map((e) => (
          <div key={e} className="bg-card border border-border rounded-[8px] px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-black">{resumen[e]}</p>
            <StatusBadge label={ESTADO_LABEL[e]} tone={ESTADO_TONE[e]} />
          </div>
        ))}
      </div>

      {/* Lista de requisitos */}
      {rows.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[8px] p-10 text-center text-muted-foreground text-sm">
          No hay requisitos de compliance configurados para {destinatario.nombre}.<br />
          <span className="text-xs mt-1 block text-muted-foreground/60">
            Agregá requisitos desde la base de datos vinculándolos a este organismo.
          </span>
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
            startTransition(() => router.refresh());
          }}
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
}: {
  row: OrganismoChecklistRow;
  canWrite: boolean;
  onUpload: () => void;
  onEdit: () => void;
  onOpenFile: (id: string) => void;
}) {
  const faltante = row.estado === "faltante";
  const vencido = row.estado === "vencido";
  const porVencer = row.estado === "por_vencer";

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
      {/* Ícono de estado */}
      <div className="shrink-0">
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

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        {row.archivo_id && (
          <button
            type="button"
            onClick={() => onOpenFile(row.archivo_id!)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-primary hover:border-[#BAE6FD] hover:bg-[#F0F9FF] transition-colors"
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
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-primary hover:border-[#BAE6FD] hover:bg-[#F0F9FF] transition-colors"
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
      </div>
    </div>
  );
}
