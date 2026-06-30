/**
 * Descarga un Excel generado por un route handler (GET que devuelve el archivo).
 * Si el endpoint responde con error (404 sin datos, etc.) lanza con el mensaje
 * para que ExportButton lo muestre inline.
 */
export async function descargarExport(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? "No se pudo generar el Excel.");
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}
