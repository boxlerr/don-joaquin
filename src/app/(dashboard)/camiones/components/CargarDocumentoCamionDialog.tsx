"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import AdjuntosDocumentos, { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  registrarDocumentoCamionAction,
  updateDocumentoCamionAction,
  crearUrlSubidaCamionDocAction,
  getCamionDocumentoArchivosAction,
  deleteCamionDocumentoArchivoAction,
} from "../actions";
import type { TipoDocumentoCamion } from "../types";
import { AlertCircle } from "lucide-react";

export type DocumentoEditing = {
  id: string;
  tipo_documento: string | null;
  numero: string | null;
  fecha_vencimiento: string | null;
};

interface Props {
  camion_id: string;
  tipos: TipoDocumentoCamion[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  editing?: DocumentoEditing | null;
}

export default function CargarDocumentoCamionDialog({
  camion_id,
  tipos,
  open,
  onOpenChange,
  onSuccess,
  editing,
}: Props) {
  const isEdit = !!editing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedWarning, setSavedWarning] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [tipoNombreCustom, setTipoNombreCustom] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");

  const isOtro = tipoId === "__otro__";

  const adj = useAdjuntos({
    open,
    entidadId: editing?.id ?? null,
    crearUrlSubida: (input) => crearUrlSubidaCamionDocAction({ camion_id, filename: input.filename }),
    getArchivos: getCamionDocumentoArchivosAction,
    deleteArchivo: deleteCamionDocumentoArchivoAction,
    onError: setError,
  });

  const reset = () => {
    setTipoId("");
    setTipoNombreCustom("");
    setNumero("");
    setFechaVencimiento("");
    setFechaEmision("");
    setError(null);
    setSavedWarning(null);
  };

  const cerrarConExito = () => {
    reset();
    onSuccess();
  };

  useEffect(() => {
    if (open && editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al abrir/cambiar de documento
      setNumero(editing.numero ?? "");
      setFechaVencimiento(editing.fecha_vencimiento ?? "");
      setFechaEmision("");
      setError(null);
      setSavedWarning(null);
    } else if (open) {
      reset();
    }
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit) {
      if (!tipoId) return setError("Seleccioná un tipo de documento");
      if (isOtro && !tipoNombreCustom.trim()) return setError("Escribí el nombre del tipo de documento");
      if (adj.pendientes.length === 0) return setError("Adjuntá al menos un archivo");
    }

    setLoading(true);
    setError(null);
    try {
      const adjuntos = await adj.subirPendientes();

      const res = isEdit
        ? await updateDocumentoCamionAction({
            doc_id: editing!.id,
            numero: numero || null,
            fecha_vencimiento: fechaVencimiento || null,
            fecha_emision: fechaEmision || null,
            adjuntos_nuevos: adjuntos,
          })
        : await registrarDocumentoCamionAction({
            camion_id,
            tipo_documento_id: isOtro ? null : tipoId,
            tipo_nombre_custom: isOtro ? tipoNombreCustom.trim() : null,
            numero: numero || null,
            fecha_emision: fechaEmision || null,
            fecha_vencimiento: fechaVencimiento || null,
            adjuntos,
          });

      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("adjuntosFallidos" in res && res.adjuntosFallidos) {
        setSavedWarning(
          `El documento se guardó, pero ${res.adjuntosFallidos} archivo(s) no se pudieron adjuntar. Cerrá y volvé a cargarlos.`,
        );
      } else {
        cerrarConExito();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el documento.");
    } finally {
      setLoading(false);
    }
  };

  const selectedLabel = tipoId === "__otro__" ? "Otro..." : tipos.find((t) => t.id === tipoId)?.nombre;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (loading) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            {isEdit ? "Actualizar documento" : "Cargar documento"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? "Actualizá la fecha de vencimiento y sumá/quitá archivos."
              : "Cualquier formato — podés adjuntar varios, hasta 100 MB c/u."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
          {savedWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <span>{savedWarning}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Tipo de documento</Label>
            {isEdit ? (
              <div className="h-10 px-3 flex items-center rounded-lg border border-border bg-muted/40 text-sm text-foreground">
                {editing?.tipo_documento ?? "Documento"}
              </div>
            ) : tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">No hay tipos de documento disponibles</p>
            ) : (
              <>
                <Select
                  value={tipoId}
                  disabled={loading}
                  onValueChange={(v) => {
                    setTipoId(v ?? "");
                    if (v !== "__otro__") setTipoNombreCustom("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo...">
                      {tipoId ? selectedLabel : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                    <SelectItem value="__otro__">Otro...</SelectItem>
                  </SelectContent>
                </Select>

                {isOtro && (
                  <Input
                    className="mt-2"
                    placeholder="Nombre del documento (ej: Seguro)"
                    value={tipoNombreCustom}
                    onChange={(e) => setTipoNombreCustom(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Número</Label>
              <Input placeholder="Opcional" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Fecha emisión</Label>
              <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Fecha vencimiento</Label>
            <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} disabled={loading} />
          </div>

          <AdjuntosDocumentos
            ctrl={adj}
            disabled={loading}
            label="Archivos"
            hint={isEdit ? "sumá o quitá archivos" : "PDF, foto… — podés subir varios"}
          />

          <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
            {savedWarning ? (
              <Button type="button" variant="brand" onClick={cerrarConExito}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    onOpenChange(false);
                  }}
                  disabled={loading}
                  className="text-muted-foreground border-border"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading
                    ? adj.subiendo
                      ? `Subiendo ${adj.subiendo.idx}/${adj.subiendo.total}…`
                      : "Guardando…"
                    : isEdit
                    ? "Actualizar"
                    : "Cargar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
