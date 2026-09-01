"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Plus, Camera } from "lucide-react";
import AdjuntosInline from "./AdjuntosInline";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import type { AdjuntoExistente, ArchivoMeta, CrearUrlResult } from "@/lib/adjuntos-server";

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/**
 * Panel de adjuntos para una entidad YA existente: lista (ver/descargar/borrar) +
 * botón "Agregar archivos" que sube y vincula al instante (ej: sumar el video a un
 * apercibimiento ya cargado). Reutilizable: recibe las actions de la entidad.
 */
export default function AdjuntosEditable({
  entidadId,
  getArchivos,
  crearUrlSubida,
  vincularArchivos,
  deleteArchivo,
  canEdit = true,
  addLabel = "Agregar archivos",
  emptyHint,
  permitirFoto = false,
}: {
  entidadId: string;
  getArchivos: (id: string) => Promise<AdjuntoExistente[]>;
  crearUrlSubida: (input: { filename: string }) => Promise<CrearUrlResult>;
  vincularArchivos: (
    entidadId: string,
    adjuntos: ArchivoMeta[],
  ) => Promise<{ ok?: boolean; error?: string; fallidos?: number }>;
  deleteArchivo?: (adjuntoId: string) => Promise<{ ok?: boolean; error?: string; success?: boolean }>;
  canEdit?: boolean;
  addLabel?: string;
  emptyHint?: string;
  /** Muestra además "Sacar foto" (abre la cámara del teléfono). Para papeles que
   *  llegan en mano: un CV, un carnet, un remito. */
  permitirFoto?: boolean;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Input aparte para la cámara: `capture` en el input general le sacaría al
  // teléfono la opción de elegir un archivo ya guardado.
  const camaraRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" supera los ${MAX_MB} MB permitidos por archivo.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    const metas: ArchivoMeta[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        setSubiendo({ idx: i + 1, total: arr.length, pct: 0 });
        const url = await crearUrlSubida({ filename: f.name });
        if ("error" in url) throw new Error(url.error);
        await subirArchivoConUrlFirmada({
          signedUrl: url.signedUrl,
          file: f,
          onProgress: (pct) => setSubiendo({ idx: i + 1, total: arr.length, pct }),
        });
        metas.push({
          bucket: url.bucket,
          path: url.path,
          nombre_original: f.name,
          mime_type: f.type || "application/octet-stream",
          tamano_bytes: f.size,
        });
      }
      const res = await vincularArchivos(entidadId, metas);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else if (res?.fallidos) {
        setError(`${res.fallidos} archivo(s) no se pudieron adjuntar. Probá de nuevo.`);
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron subir los archivos.");
    } finally {
      setSubiendo(null);
      if (fileRef.current) fileRef.current.value = "";
      if (camaraRef.current) camaraRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <AdjuntosInline
        entidadId={entidadId}
        getArchivos={getArchivos}
        deleteArchivo={deleteArchivo}
        canDelete={canEdit}
        refreshKey={refreshKey}
        emptyHint={emptyHint}
      />

      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          {permitirFoto && (
            <input
              ref={camaraRef}
              type="file"
              // `capture="environment"` abre directo la cámara trasera. Sin esto
              // el teléfono muestra un menú y hay que elegir "Sacar foto" ahí,
              // que es justo el paso que sobraba: "el CV lo quiero subir
              // sacándole una foto desde el celu y ya" (Bárbara, 01/09/26).
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          )}
          {subiendo ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Subiendo {subiendo.idx} de {subiendo.total}…
                </span>
                <span className="font-mono">{subiendo.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-[#0088D1] rounded-full transition-all duration-200" style={{ width: `${subiendo.pct}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0088D1] hover:text-[#0277BD] hover:underline"
              >
                <Plus size={13} />
                <Upload size={12} />
                {addLabel}
              </button>
              {/* Sólo en pantallas chicas: en la compu "Sacar foto" abre la
                  webcam, que no sirve para fotografiar un papel. */}
              {permitirFoto && (
                <button
                  type="button"
                  onClick={() => camaraRef.current?.click()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#BAE6FD] bg-[#E1F5FE] px-2.5 text-xs font-semibold text-[#0369A1] transition-colors hover:bg-[#BAE6FD]/60 sm:hidden"
                >
                  <Camera size={13} />
                  Sacar foto
                </button>
              )}
            </div>
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
