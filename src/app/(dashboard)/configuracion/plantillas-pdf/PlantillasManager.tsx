"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { FileText, Plus, DownloadCloud, Eye, Edit2, Trash2, AlertCircle } from "lucide-react";
import { createPlantillaAction, deletePlantillaAction, type Plantilla, type PlantillaTipo } from "./actions";

const TIPOS: { value: PlantillaTipo; label: string }[] = [
  { value: "remito", label: "Remito" },
  { value: "factura", label: "Factura" },
  { value: "gasoil", label: "Gasoil" },
  { value: "liquidacion", label: "Liquidación" },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Props {
  plantillas: Plantilla[];
}

export default function PlantillasManager({ plantillas }: Props) {
  const router = useRouter();

  // Dialogs UI state
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOf, setPreviewOf] = useState<Plantilla | null>(null);
  const [deleteOf, setDeleteOf] = useState<Plantilla | null>(null);

  // Create form state
  const [formNombre, setFormNombre] = useState("");
  const [formTipo, setFormTipo] = useState<PlantillaTipo>("remito");
  const [formError, setFormError] = useState<string | null>(null);
  const [createPending, startCreate] = useTransition();

  // Delete state
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();

  function resetForm() {
    setFormNombre("");
    setFormTipo("remito");
    setFormError(null);
  }

  function onCreateOpenChange(next: boolean) {
    if (next) resetForm();
    setCreateOpen(next);
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startCreate(async () => {
      const result = await createPlantillaAction({ nombre: formNombre, tipo: formTipo });
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      setCreateOpen(false);
      router.refresh();
    });
  }

  function onDeleteConfirm() {
    if (!deleteOf) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deletePlantillaAction(deleteOf.id);
      if ("error" in result) {
        setDeleteError(result.error);
        return;
      }
      setDeleteOf(null);
      router.refresh();
    });
  }

  const ordenadas = [...plantillas].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <div className="flex items-center justify-end -mt-12 mb-4">
        <Button variant="brand" size="sm" onClick={() => onCreateOpenChange(true)}>
          <Plus size={14} />
          Nueva plantilla
        </Button>
      </div>

      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Plantillas disponibles</h2>
            <span className="ml-auto text-xs text-muted-foreground">{ordenadas.length} plantillas</span>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Nombre", "Tipo", "Estado", "Creado", "Acciones"].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.length === 0 ? (
              <EmptyTableRow message="Sin plantillas registradas" />
            ) : (
              ordenadas.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-block px-2 py-1 bg-[#E1F5FE] text-primary text-xs font-medium rounded">
                      {p.tipo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={p.estado === "activo" ? "Activa" : "En desarrollo"}
                      tone={p.estado === "activo" ? "success" : "warning"}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-2 hover:bg-[#E1F5FE] rounded-md transition-colors"
                        title="Ver previsualización"
                        onClick={() => setPreviewOf(p)}
                      >
                        <Eye size={14} className="text-primary" />
                      </button>
                      <a
                        href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Plantilla: ${p.nombre} (${p.tipo})`)}`}
                        download={`${p.tipo}-ejemplo.txt`}
                        className="p-2 hover:bg-[#E1F5FE] rounded-md transition-colors inline-flex"
                        title="Descargar ejemplo"
                      >
                        <DownloadCloud size={14} className="text-primary" />
                      </a>
                      <button
                        type="button"
                        className="p-2 rounded-md opacity-40 cursor-not-allowed"
                        title="Editor visual (próximamente)"
                        disabled
                      >
                        <Edit2 size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="p-2 hover:bg-[#FEF2F2] rounded-md transition-colors"
                        title="Eliminar"
                        onClick={() => { setDeleteOf(p); setDeleteError(null); }}
                      >
                        <Trash2 size={14} className="text-[#EF4444]" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog: Crear */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
            <DialogDescription>
              Definí el tipo y nombre. El editor visual se habilita en una próxima versión.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nueva-nombre">Nombre</Label>
              <Input
                id="nueva-nombre"
                value={formNombre}
                onChange={(e) => { setFormNombre(e.target.value); setFormError(null); }}
                placeholder="Ej: Remito estándar"
                autoFocus
                disabled={createPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nueva-tipo">Tipo</Label>
              <Combobox
                id="nueva-tipo"
                value={formTipo}
                onValueChange={(v) => setFormTipo(v as PlantillaTipo)}
                disabled={createPending}
                options={TIPOS.map((t) => ({ id: t.value, label: t.label }))}
                searchable={false}
                triggerClassName="h-8 w-full text-sm"
              />
            </div>
            {formError && (
              <div className="text-xs text-[#7F1D1D] bg-[#FEF2F2] border border-[#FEE2E2] rounded-md px-3 py-2 flex items-start gap-2">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onCreateOpenChange(false)} disabled={createPending}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={createPending}>
                {createPending ? "Guardando..." : "Crear plantilla"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Preview */}
      <Dialog open={!!previewOf} onOpenChange={(o) => !o && setPreviewOf(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Previsualización · {previewOf?.nombre}</DialogTitle>
            <DialogDescription>Render aproximado del template.</DialogDescription>
          </DialogHeader>
          {previewOf && (
            <iframe
              title={`Preview ${previewOf.nombre}`}
              className="w-full h-80 rounded-md border border-border bg-card"
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
                body{font-family:-apple-system,system-ui,sans-serif;padding:24px;color:#0F172A}
                h1{font-size:18px;margin:0 0 4px}
                .meta{color:#64748B;font-size:12px;margin-bottom:16px}
                .placeholder{border:1px dashed #CBD5E1;padding:16px;border-radius:8px;color:#475569;font-size:13px}
              </style></head><body>
                <h1>${escapeHtml(previewOf.nombre)}</h1>
                <div class="meta">Tipo: ${previewOf.tipo} · Estado: ${previewOf.estado}</div>
                <div class="placeholder">Contenido del template "${previewOf.tipo}" — placeholder.</div>
              </body></html>`}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOf(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar borrado */}
      <Dialog open={!!deleteOf} onOpenChange={(o) => !o && setDeleteOf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar plantilla</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteOf?.nombre}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-xs text-[#7F1D1D] bg-[#FEF2F2] border border-[#FEE2E2] rounded-md px-3 py-2 flex items-center gap-2">
              <AlertCircle size={12} />
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOf(null)} disabled={deletePending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDeleteConfirm} disabled={deletePending}>
              {deletePending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
