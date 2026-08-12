"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, X, ZoomIn } from "lucide-react";

/**
 * El lado derecho del diálogo de carga: elegir los archivos y VERLOS.
 *
 * Antes era un renglón punteado y, después de elegir, una lista de nombres. Con
 * eso no había forma de darse cuenta de que se había adjuntado el papel
 * equivocado hasta después de guardarlo — y el nombre no ayuda: la mitad de lo
 * que llega del celular se llama "IMG_4821.jpg" o "scan0001.pdf".
 *
 * Ahora las imágenes se ven en miniatura y cualquier archivo se abre en una
 * pestaña para revisarlo antes de subir. La vista previa sale de un `blob:` del
 * navegador: el archivo todavía no viajó a ningún lado.
 */

const MAX_MB = 100;

export type ArchivoElegido = { file: File; preview: string | null };

/** Las que el navegador sabe dibujar sin ayuda. El resto va con su ícono. */
function esImagen(f: File): boolean {
  return f.type.startsWith("image/");
}

function pesa(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ArchivosCargar({
  archivos,
  onChange,
  onError,
  subiendo,
  titulo,
  ayuda,
}: {
  archivos: ArchivoElegido[];
  onChange: (a: ArchivoElegido[]) => void;
  onError: (mensaje: string | null) => void;
  /** Progreso mientras suben, para bloquear la caja y mostrar en qué va. */
  subiendo: { idx: number; total: number; pct: number } | null;
  titulo: string;
  ayuda: string;
}) {
  const [encima, setEncima] = useState(false);

  // Las URLs `blob:` viven en el documento hasta que se las suelta: sin esto,
  // abrir el diálogo veinte veces deja veinte archivos en memoria.
  useEffect(() => {
    return () => {
      for (const a of archivos) if (a.preview) URL.revokeObjectURL(a.preview);
    };
    // Sólo al desmontar: adentro se liberan una por una en `quitar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agregar = (lista: FileList | File[] | null) => {
    if (!lista) return;
    const nuevos = Array.from(lista);
    if (nuevos.length === 0) return;

    const grande = nuevos.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (grande) {
      onError(`"${grande.name}" supera los ${MAX_MB} MB permitidos.`);
      return;
    }
    onError(null);

    const clave = (f: File) => `${f.name}:${f.size}`;
    const yaHay = new Set(archivos.map((a) => clave(a.file)));
    const suma = nuevos
      .filter((f) => !yaHay.has(clave(f)))
      .map((file) => ({ file, preview: esImagen(file) ? URL.createObjectURL(file) : null }));
    if (suma.length > 0) onChange([...archivos, ...suma]);
  };

  const quitar = (i: number) => {
    const fuera = archivos[i];
    if (fuera?.preview) URL.revokeObjectURL(fuera.preview);
    onChange(archivos.filter((_, idx) => idx !== i));
  };

  const abrir = (a: ArchivoElegido) => {
    const url = a.preview ?? URL.createObjectURL(a.file);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-0 flex-col">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{ayuda}</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          agregar(e.dataTransfer.files);
        }}
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          encima
            ? "border-[#0088D1] bg-[#F0F9FF]"
            : "border-[#CBD5E1] hover:border-[#0088D1] hover:bg-[#F0F9FF]"
        }`}
      >
        <Upload size={18} className="text-muted-foreground/70" />
        <span className="text-[13px] font-medium text-foreground">
          {archivos.length ? "Agregar más archivos" : "Arrastrá el documento acá"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          o tocá para elegirlo · hasta {MAX_MB} MB cada uno
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {archivos.length > 0 && (
        <ul className="mt-2 space-y-1.5 overflow-y-auto">
          {archivos.map((a, i) => (
            <li
              key={`${a.file.name}:${a.file.size}:${i}`}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-1.5"
            >
              <button
                type="button"
                onClick={() => abrir(a)}
                title="Abrir para revisarlo"
                className="group relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
              >
                {a.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob local
                  <img src={a.preview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    <FileText size={18} />
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-foreground/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn size={15} />
                </span>
              </button>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {a.file.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{pesa(a.file.size)}</span>
              </span>

              <button
                type="button"
                onClick={() => quitar(i)}
                disabled={!!subiendo}
                aria-label={`Quitar ${a.file.name}`}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {subiendo && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Subiendo {subiendo.idx} de {subiendo.total}…
            </span>
            <span className="font-mono">{subiendo.pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#0088D1] transition-all duration-200"
              style={{ width: `${subiendo.pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
