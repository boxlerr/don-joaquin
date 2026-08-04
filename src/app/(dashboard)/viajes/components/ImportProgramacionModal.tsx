"use client";

/**
 * Importar la programación de viajes.
 *
 * Los viajes entran SIN CHOFER y después Nico los asigna — que es exactamente
 * lo que él hace hoy a mano: recibe el Excel, lo anota en un papel y cuando le
 * da el viaje a alguien lo subraya y le escribe el nombre.
 *
 * Nunca crea nada sin mostrar antes qué va a crear.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import {
  getClientesProgramacionAction,
  importarProgramacionAction,
  previewProgramacionAction,
  type ClienteOpcion,
  type PreviewProgramacion,
} from "../import-programacion/actions";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ImportProgramacionModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<{ nombre: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<PreviewProgramacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; errores: string[] } | null>(null);
  // A quién se le factura no está en el archivo: se elige acá. Ver el comentario
  // de la acción — el "Nombre cliente" del Excel son plantas, no la empresa.
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [clienteId, setClienteId] = useState("");

  useEffect(() => {
    if (!open || clientes.length > 0) return;
    let vivo = true;
    getClientesProgramacionAction()
      .then((r) => {
        if (!vivo) return;
        setClientes(r.clientes);
        setClienteId((prev) => prev || r.sugeridoId || "");
      })
      .catch(() => {
        if (vivo) setError("No se pudo cargar la lista de clientes.");
      });
    return () => {
      vivo = false;
    };
  }, [open, clientes.length]);

  const reset = () => {
    setArchivo(null);
    setPreview(null);
    setError(null);
    setResultado(null);
  };

  const pedirPreview = async (a: { nombre: string; base64: string }) => {
    setCargando(true);
    setError(null);
    const res = await previewProgramacionAction(a.base64, a.nombre);
    setCargando(false);
    if ("error" in res) {
      setPreview(null);
      setError(res.error);
      return;
    }
    setPreview(res);
  };

  const elegirArchivo = async (file: File) => {
    setResultado(null);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const a = { nombre: file.name, base64 };
    setArchivo(a);
    await pedirPreview(a);
  };

  const importar = async () => {
    if (!archivo) return;
    setImportando(true);
    setError(null);
    const res = await importarProgramacionAction(archivo.base64, archivo.nombre, clienteId);
    setImportando(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResultado({ creados: res.creados, errores: res.errores });
    setPreview(null);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (importando) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">Programación de viajes</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            El Excel que llega con los viajes del día. Entran <b>sin chofer</b>: después se asignan
            desde el listado o desde “A dónde fueron”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="flex items-start gap-2 border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          {resultado ? (
            <div className="space-y-2 rounded-[8px] border border-[#A7F3D0] px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[#065F46]">
                <Check size={15} />
                Se crearon {resultado.creados} viaje{resultado.creados !== 1 ? "s" : ""} sin chofer.
              </p>
              <Link
                href="/viajes?falta=chofer"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                Asignarles el chofer ahora <ArrowUpRight size={12} />
              </Link>
              {resultado.errores.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[12px] text-[#B45309]">
                  {resultado.errores.slice(0, 5).map((e) => (
                    <li key={e}>· {e}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-border px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30">
                <input
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void elegirArchivo(f);
                  }}
                />
                {cargando ? (
                  <Loader2 size={20} className="animate-spin text-primary" />
                ) : (
                  <FileSpreadsheet size={20} className="text-[#059669]" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {archivo ? archivo.nombre : "Elegí el Excel de la programación"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  .xlsx — el que llega con los números de transporte
                </span>
              </label>

              {preview && (
                <>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      ¿A qué cliente van estos viajes?
                    </p>
                    <Combobox
                      options={clientes}
                      value={clienteId}
                      onValueChange={setClienteId}
                      placeholder="Elegí el cliente…"
                      searchPlaceholder="Buscar cliente…"
                      aria-label="Cliente al que se le facturan estos viajes"
                      triggerClassName="h-9 text-[13px]"
                    />
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      El archivo no lo dice: el “Nombre cliente” del Excel son plantas
                      (FÁBRICA RAMALLO, LOMASER), no la empresa. Hoy lo manda Loma Negra, así que
                      viene propuesta.
                    </p>
                  </div>

                  {/* Se carga el Centro tal cual (A111 / A109) y el
                      destinatario como destino. Que se lea antes de crear, no
                      después de importar 12 viajes al revés. */}
                  <p className="rounded-[6px] border border-border px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                    <b className="text-foreground">Desde</b> es el código de planta del archivo
                    (A111 / A109) y <b className="text-foreground">hasta</b> es el destinatario.
                    Entran así y se corrigen después desde el listado o desde “A dónde fueron”.
                  </p>

                  <div className="flex flex-wrap gap-2 text-[12px]">
                    <span className="rounded-[6px] border border-border px-2 py-1">
                      {preview.filasLeidas} fila{preview.filasLeidas !== 1 ? "s" : ""} leída
                      {preview.filasLeidas !== 1 ? "s" : ""}
                    </span>
                    <span className="rounded-[6px] border border-[#A7F3D0] px-2 py-1 font-medium text-[#065F46]">
                      {preview.resumen.aCrear} a crear
                    </span>
                    {preview.resumen.yaExisten > 0 && (
                      <span className="rounded-[6px] border border-border px-2 py-1 text-muted-foreground">
                        {preview.resumen.yaExisten} ya estaban cargados
                      </span>
                    )}
                    {preview.resumen.conProblema > 0 && (
                      <span className="rounded-[6px] border border-[#B45309]/40 px-2 py-1 text-[#B45309]">
                        {preview.resumen.conProblema} no se pueden crear
                      </span>
                    )}
                  </div>

                  <div className="max-h-[38vh] overflow-auto rounded-[8px] border border-border">
                    <table className="w-full min-w-[520px] text-[12px]">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pl-3 pr-2 text-left font-medium">Transporte</th>
                          <th className="px-2 py-2 text-left font-medium">Fecha</th>
                          <th className="px-2 py-2 text-left font-medium">Desde</th>
                          <th className="px-2 py-2 text-left font-medium">Hasta</th>
                          <th className="px-2 py-2 text-right font-medium">Tn</th>
                          <th className="py-2 pl-2 pr-3 text-left font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {preview.viajes.map((v) => (
                          <tr key={v.nroTransporte} className={v.yaExiste ? "opacity-50" : ""}>
                            <td className="py-2 pl-3 pr-2 font-mono">
                              {v.nroCorto}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                et. {v.etapa}
                              </span>
                            </td>
                            <td className="px-2 py-2 font-mono text-[11px]">{fmtFecha(v.fecha)}</td>
                            <td className="px-2 py-2">
                              {v.origen ?? <span className="text-muted-foreground/60">—</span>}
                            </td>
                            <td className="px-2 py-2">
                              {v.destino ?? <span className="text-muted-foreground/60">—</span>}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">
                              {v.toneladas ?? "—"}
                            </td>
                            <td className="py-2 pl-2 pr-3">
                              {v.yaExiste ? (
                                <span className="text-muted-foreground">ya estaba</span>
                              ) : v.problema ? (
                                <span className="text-[#B45309]">{v.problema}</span>
                              ) : (
                                <span className="text-[#065F46]">se crea</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {preview.circuitos.length > 0 && (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Circuitos detectados (los pares que anotás juntos):{" "}
                      {preview.circuitos
                        .slice(0, 6)
                        .map((c) => c.nros.join(" + "))
                        .join(" · ")}
                      {preview.circuitos.length > 6 && ` y ${preview.circuitos.length - 6} más`}.
                      Cada etapa entra como un viaje suelto.
                    </p>
                  )}

                  {preview.columnasIgnoradas.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Columnas que no uso: {preview.columnasIgnoradas.join(", ")}.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={importando}
            className="border-border text-muted-foreground"
          >
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          {!resultado && (
            <Button
              type="button"
              variant="brand"
              onClick={importar}
              disabled={importando || !preview || preview.resumen.aCrear === 0 || !clienteId}
            >
              {importando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importando
                ? "Creando…"
                : preview
                  ? `Crear ${preview.resumen.aCrear} viaje${preview.resumen.aCrear !== 1 ? "s" : ""}`
                  : "Crear viajes"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
