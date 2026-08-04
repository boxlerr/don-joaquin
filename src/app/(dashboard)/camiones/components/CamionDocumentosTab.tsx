"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import CargarDocumentoCamionDialog, { type DocumentoEditing } from "./CargarDocumentoCamionDialog";
import {
  deleteDocumentoCamionAction,
  getCamionDocumentoArchivosAction,
  deleteCamionDocumentoArchivoAction,
} from "../actions";
import { FileText, Plus, Trash2, Pencil, Calendar, Hash } from "lucide-react";
import type { DocumentoVigenciaCamion, TipoDocumentoCamion } from "../types";
import { formatFecha } from "@/lib/utils";
import AdjuntosInline from "@/components/ui/AdjuntosInline";

interface Props {
  camion_id: string;
  documentos: DocumentoVigenciaCamion[];
  tipos: TipoDocumentoCamion[];
  onRefresh: () => void;
}

function vigenciaTone(estado: string | null): "success" | "warning" | "error" | "neutral" {
  if (!estado) return "neutral";
  if (estado === "vigente") return "success";
  if (estado === "por_vencer") return "warning";
  if (estado === "vencido") return "error";
  return "neutral";
}

function vigenciaLabel(estado: string | null, dias: number | null): string {
  if (!estado) return "Sin vencimiento";
  if (estado === "vigente") return "Vigente";
  if (estado === "por_vencer") return dias != null ? `Vence en ${dias}d` : "Por vencer";
  if (estado === "vencido") return dias != null ? `Vencido hace ${Math.abs(dias)}d` : "Vencido";
  return estado;
}

const ACCENT: Record<string, string> = {
  vigente: "border-l-[#22C55E]",
  por_vencer: "border-l-[#F59E0B]",
  vencido: "border-l-[#EF4444]",
};

export default function CamionDocumentosTab({ camion_id, documentos, tipos, onRefresh }: Props) {
  const [cargarOpen, setCargarOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentoEditing | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const docs = documentos.filter((d) => d.id !== null);

  const handleDelete = async (doc: DocumentoVigenciaCamion) => {
    if (!doc.id) return;
    if (!confirm(`¿Eliminar el documento "${doc.tipo_documento}"?`)) return;
    setDeleting(doc.id);
    await deleteDocumentoCamionAction(doc.id);
    setDeleting(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Documentación del vehículo
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {docs.length} documento{docs.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <Button
          variant="brand"
          size="sm"
          onClick={() => setCargarOpen(true)}
        >
          <Plus size={14} className="mr-1" />
          Cargar documento
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={FileText} message="Sin documentos cargados" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {docs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              onEdit={() =>
                setEditing({
                  id: doc.id!,
                  tipo_documento: doc.tipo_documento,
                  numero: doc.numero,
                  fecha_vencimiento: doc.fecha_vencimiento,
                })
              }
              onDelete={() => handleDelete(doc)}
              deleting={deleting === doc.id}
            />
          ))}
        </div>
      )}

      <CargarDocumentoCamionDialog
        camion_id={camion_id}
        tipos={tipos}
        open={cargarOpen}
        onOpenChange={setCargarOpen}
        onSuccess={() => {
          setCargarOpen(false);
          onRefresh();
        }}
      />

      <CargarDocumentoCamionDialog
        camion_id={camion_id}
        tipos={tipos}
        editing={editing}
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        onSuccess={() => {
          setEditing(null);
          onRefresh();
        }}
      />
    </div>
  );
}

function DocCard({
  doc,
  onEdit,
  onDelete,
  deleting,
}: {
  doc: DocumentoVigenciaCamion;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const accent = ACCENT[doc.estado_vigencia ?? ""] ?? "border-l-border";

  return (
    <div
      className={`group bg-card rounded-lg border border-border border-l-[3px] ${accent} p-3 sm:p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-[#E1F5FE] flex items-center justify-center text-primary shrink-0">
            <FileText size={15} />
          </div>
          <span className="text-sm font-semibold text-foreground truncate">
            {doc.tipo_documento ?? "Documento"}
          </span>
        </div>
        <StatusBadge
          label={vigenciaLabel(doc.estado_vigencia, doc.dias_restantes)}
          tone={vigenciaTone(doc.estado_vigencia)}
        />
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Calendar size={12} className="text-muted-foreground/60" />
          {doc.fecha_vencimiento ? (
            <>Vence el <span className="text-foreground font-medium">{formatFecha(doc.fecha_vencimiento)}</span></>
          ) : (
            <span className="italic text-muted-foreground/60">Sin fecha de vencimiento</span>
          )}
        </p>
        {doc.numero && (
          <p className="flex items-center gap-1.5">
            <Hash size={12} className="text-muted-foreground/60" />
            <span className="font-mono">{doc.numero}</span>
          </p>
        )}
      </div>

      {doc.id && (
        <AdjuntosInline
          entidadId={doc.id}
          getArchivos={getCamionDocumentoArchivosAction}
          deleteArchivo={deleteCamionDocumentoArchivoAction}
          canDelete
          compact
          emptyHint="Sin archivos"
        />
      )}

      <div className="mt-auto pt-2.5 border-t border-[#F1F5F9] flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-9 sm:h-8 flex-1 border-[#BAE6FD] text-primary hover:bg-[#E1F5FE]"
        >
          <Pencil size={13} className="mr-1" />
          Actualizar
        </Button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="size-9 sm:size-8 shrink-0 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          title="Eliminar documento"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
