"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import CargarDocumentoCamionDialog from "./CargarDocumentoCamionDialog";
import { deleteDocumentoCamionAction } from "../actions";
import { FileText, Plus, Trash2 } from "lucide-react";
import type { DocumentoVigenciaCamion, TipoDocumentoCamion } from "../types";
import { formatFecha } from "@/lib/utils";

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
  if (!estado) return "Sin estado";
  if (estado === "vigente") return "Vigente";
  if (estado === "por_vencer") return dias != null ? `Vence en ${dias}d` : "Por vencer";
  if (estado === "vencido") return dias != null ? `Vencido hace ${Math.abs(dias)}d` : "Vencido";
  return estado;
}

export default function CamionDocumentosTab({ camion_id, documentos, tipos, onRefresh }: Props) {
  const [cargarOpen, setCargarOpen] = useState(false);
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Documentación del vehículo
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {docs.length} documento{docs.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
          onClick={() => setCargarOpen(true)}
        >
          <Plus size={13} className="mr-1.5 text-primary" />
          Cargar documento
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={FileText} message="Sin documentos cargados" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
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
    </div>
  );
}

function DocCard({
  doc,
  onDelete,
  deleting,
}: {
  doc: DocumentoVigenciaCamion;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {doc.tipo_documento ?? "Documento"}
          </span>
        </div>
        <StatusBadge
          label={vigenciaLabel(doc.estado_vigencia, doc.dias_restantes)}
          tone={vigenciaTone(doc.estado_vigencia)}
        />
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {doc.numero && (
          <p>
            <span className="text-muted-foreground/70">Nº:</span>{" "}
            <span className="font-mono">{doc.numero}</span>
          </p>
        )}
        {doc.fecha_vencimiento && (
          <p>
            <span className="text-muted-foreground/70">Vence:</span>{" "}
            {formatFecha(doc.fecha_vencimiento)}
          </p>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-[#F1F5F9]">
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
        >
          <Trash2 size={11} />
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </div>
  );
}
