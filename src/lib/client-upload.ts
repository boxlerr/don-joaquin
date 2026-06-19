"use client";

/**
 * Subida de archivos directa navegador → Supabase Storage usando una URL
 * firmada (`createSignedUploadUrl`).
 *
 * Por qué no se usa un Server Action para recibir el archivo: en Vercel el body
 * de un Server Action está topeado en ~4,5 MB. Archivos más grandes fallaban en
 * el borde y la UI quedaba "Subiendo..." para siempre. Mandando el archivo
 * directo al Storage con la URL firmada, el límite real pasa a ser el del bucket
 * (hoy 100 MB) y además obtenemos progreso real de subida.
 */

export type ArchivoSubido = {
  bucket: string;
  path: string;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
};

function mensajeHttp(status: number): string {
  if (status === 413) return "El archivo es demasiado grande para el servidor.";
  if (status === 401 || status === 403) return "La autorización de la subida expiró. Volvé a intentar.";
  if (status === 0) return "Se interrumpió la conexión durante la subida.";
  return `Falló la subida (error ${status}).`;
}

/**
 * Sube `file` a la URL firmada y reporta progreso. Resuelve cuando el archivo
 * quedó en el Storage. Lanza Error con mensaje claro si algo falla.
 */
export function subirArchivoConUrlFirmada(opts: {
  signedUrl: string;
  file: File;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { signedUrl, file, onProgress, signal } = opts;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    if (anon) {
      xhr.setRequestHeader("apikey", anon);
      xhr.setRequestHeader("authorization", `Bearer ${anon}`);
    }
    xhr.setRequestHeader("x-upsert", "true");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Reservamos el 100% para cuando el server confirma (onload).
        onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(mensajeHttp(xhr.status)));
      }
    };
    xhr.onerror = () =>
      reject(new Error("No se pudo conectar con el servidor de archivos. Revisá tu conexión."));
    xhr.ontimeout = () => reject(new Error("La subida tardó demasiado y se canceló."));
    xhr.onabort = () => reject(new DOMException("Subida cancelada", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    // El endpoint de subida firmada espera multipart con el archivo + cacheControl
    // (mismo formato que usa @supabase/storage-js por dentro).
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    xhr.send(fd);
  });
}
