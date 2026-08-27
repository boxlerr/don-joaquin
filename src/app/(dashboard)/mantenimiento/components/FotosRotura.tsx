"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImagePlus, Loader2, Paperclip, Trash2, X } from "lucide-react";
import VisorArchivo, { type ArchivoParaVer } from "@/components/ui/VisorArchivo";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import {
  agregarArchivosRoturaAction,
  crearUrlSubidaRoturaAction,
  deleteArchivoRoturaAction,
  getArchivosRoturaAction,
  type AdjuntoArchivo,
} from "../actions";

/**
 * Las fotos de una rotura: verlas grandes, sumar y sacar.
 *
 * Vive acá y lo usan las dos pantallas que muestran una rotura —el detalle
 * desplegado de Mantenimiento y el detalle del Taller—, porque son la misma
 * cosa mirada desde la compu o desde el teléfono. Dos copias de esto
 * terminarían con la galería en una y no en la otra, que es exactamente lo que
 * pasaba antes de hoy.
 *
 * Tocar una foto la abre **adentro del sistema**, no en una pestaña suelta: se
 * pasa a la siguiente con la flecha o con el dedo y se descarga con el nombre
 * real. Antes cada foto abría una pestaña con la URL del Storage: para ver el
 * antes y el después había que abrir dos, y volver era buscar la pantalla entre
 * las pestañas.
 */

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function esImagen(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

export default function FotosRotura({
  roturaId,
  canWrite = false,
  /** Avisa cuando cambió la cantidad de fotos, para refrescar la lista de atrás. */
  onCambio,
}: {
  roturaId: string;
  canWrite?: boolean;
  onCambio?: () => void;
}) {
  // `null` = todavía no contestó. Si falla, queda en lista vacía: un spinner
  // eterno haría pensar que la foto está por aparecer cuando no va a aparecer.
  const [archivos, setArchivos] = useState<AdjuntoArchivo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [viendo, setViendo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargando = archivos === null;

  const recargar = useCallback(async () => {
    const a = await getArchivosRoturaAction(roturaId).catch(() => []);
    setArchivos(a);
  }, [roturaId]);

  useEffect(() => {
    let cancelado = false;
    getArchivosRoturaAction(roturaId)
      .then((a) => !cancelado && setArchivos(a))
      .catch(() => !cancelado && setArchivos([]));
    return () => {
      cancelado = true;
    };
  }, [roturaId]);

  const lista = archivos ?? [];
  const fotos = lista.filter((a) => esImagen(a.mime_type));
  const otros = lista.filter((a) => !esImagen(a.mime_type));

  /** Lo que ve el visor: todo junto y en el mismo orden que las miniaturas. */
  const paraVer: ArchivoParaVer[] = [...fotos, ...otros].map((a) => ({
    nombre: a.nombre_original,
    url: a.url,
    downloadUrl: a.downloadUrl || a.url,
    mime: a.mime_type,
  }));

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" pesa más de ${MAX_MB} MB y no se puede subir.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    try {
      const metas = [];
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        setSubiendo({ idx: i + 1, total: arr.length });
        const url = await crearUrlSubidaRoturaAction({ filename: f.name });
        if ("error" in url) throw new Error(url.error);
        await subirArchivoConUrlFirmada({ signedUrl: url.signedUrl, file: f });
        metas.push({
          bucket: url.bucket,
          path: url.path,
          nombre_original: f.name,
          mime_type: f.type || "application/octet-stream",
          tamano_bytes: f.size,
        });
      }
      const res = await agregarArchivosRoturaAction(roturaId, metas);
      if ("error" in res && res.error) throw new Error(res.error);
      await recargar();
      onCambio?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function borrar(id: string) {
    setConfirmar(null);
    setBorrando(id);
    const res = await deleteArchivoRoturaAction(id);
    if ("error" in res && res.error) setError(res.error);
    else {
      setArchivos((prev) => (prev ?? []).filter((a) => a.id !== id));
      onCambio?.();
    }
    setBorrando(null);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip size={12} />
          Fotos y comprobantes
        </p>
        {canWrite && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => agregar(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={subiendo !== null}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {subiendo ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Subiendo {subiendo.idx} de {subiendo.total}…
                </>
              ) : (
                <>
                  <ImagePlus size={13} />
                  Agregar fotos
                </>
              )}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Buscando los archivos…
        </p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se cargó ninguna foto.</p>
      ) : (
        <>
          {fotos.length > 0 && (
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {fotos.map((a, i) => (
                <li key={a.id} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setViendo(i)}
                    className="block"
                    aria-label={`Ver ${a.nombre_original}`}
                  >
                    {/* Achicada por el servidor. La original —2,6 MB de una
                        foto de cámara— se baja recién al abrirla en el visor,
                        que es cuando hace falta verla de verdad. */}
                    <Image
                      src={a.url}
                      alt={a.nombre_original}
                      width={160}
                      height={160}
                      sizes="160px"
                      className="h-40 w-auto rounded-lg border border-border object-cover transition-opacity hover:opacity-90"
                    />
                  </button>

                  {canWrite &&
                    (confirmar === a.id ? (
                      // Confirmar ACÁ y no en otro cartel encima: la foto se
                      // borra del todo, y hay que ver cuál se está por borrar
                      // mientras se decide.
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/90 p-2 text-center">
                        <p className="text-xs font-semibold text-foreground">
                          ¿Borrar esta foto?
                        </p>
                        <p className="text-[11px] leading-tight text-muted-foreground">
                          No se puede recuperar.
                        </p>
                        <div className="mt-0.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => borrar(a.id)}
                            className="rounded-md bg-[#991B1B] px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            Borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmar(null)}
                            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmar(a.id)}
                        disabled={borrando === a.id}
                        aria-label={`Borrar ${a.nombre_original}`}
                        className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-[#991B1B]"
                      >
                        {borrando === a.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}

          {otros.length > 0 && (
            <ul className="mt-2 space-y-1">
              {otros.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViendo(fotos.length + i)}
                    className="inline-flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="truncate">{a.nombre_original}</span>
                  </button>
                  {canWrite &&
                    (confirmar === a.id ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">¿Borrar?</span>
                        <button
                          type="button"
                          onClick={() => borrar(a.id)}
                          className="font-semibold text-[#991B1B]"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmar(null)}
                          className="font-semibold text-muted-foreground"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmar(a.id)}
                        aria-label={`Borrar ${a.nombre_original}`}
                        className="text-muted-foreground transition-colors hover:text-[#991B1B]"
                      >
                        <X size={14} />
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <VisorArchivo
        open={viendo !== null}
        onOpenChange={(v) => !v && setViendo(null)}
        archivos={paraVer}
        indice={viendo ?? 0}
      />
    </div>
  );
}
