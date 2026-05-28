"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  FileSpreadsheet,
  Truck,
  User,
} from "lucide-react";
import {
  previewHojaRutaImportAction,
  confirmHojaRutaImportAction,
  type HojaRutaPreviewState,
  type SheetPreview,
  type ImportAsignacion,
  type ConfirmImportState,
} from "../import-hojas-ruta/actions";

type Step = "select" | "preview" | "done";

type Asignacion = { chofer_id: string | null; camion_id: string | null };

export default function ImportHojasRutaModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<HojaRutaPreviewState> | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, Asignacion>>({});
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [result, setResult] = useState<NonNullable<ConfirmImportState> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    fileObjRef.current = f;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await previewHojaRutaImportAction(fd);
      if (!res || res.error || !res.ok) {
        setError(res?.error ?? "Error desconocido al analizar el archivo.");
        return;
      }
      setPreview(res);
      // Inicializar asignaciones con lo que resolvió el backend
      const init: Record<string, Asignacion> = {};
      for (const s of res.sheets ?? []) {
        const ch = s.resolucion.chofer;
        const cm = s.resolucion.camion;
        init[s.parsed.sheetName] = {
          chofer_id: ch.status === "ok" ? ch.chofer_id : null,
          camion_id: cm && cm.status !== "missing" ? cm.camion_id : null,
        };
      }
      setAsignaciones(init);
      setActiveSheet(res.sheets?.[0]?.parsed.sheetName ?? null);
      setStep("preview");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !fileObjRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const payload: ImportAsignacion[] = (preview.sheets ?? []).map((s) => ({
        sheetName: s.parsed.sheetName,
        chofer_id: asignaciones[s.parsed.sheetName]?.chofer_id ?? null,
        camion_id: asignaciones[s.parsed.sheetName]?.camion_id ?? null,
      }));
      const fd = new FormData();
      fd.set("file", fileObjRef.current);
      fd.set("asignaciones", JSON.stringify(payload));
      const res = await confirmHojaRutaImportAction(fd);
      if (!res || res.error) {
        setError(res?.error ?? "Error al confirmar.");
        return;
      }
      setResult(res);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("select");
    setError(null);
    setPreview(null);
    setAsignaciones({});
    setActiveSheet(null);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  // Asignación derivada: cuenta sheets listos para importar
  const listos = useMemo(() => {
    if (!preview) return 0;
    return (preview.sheets ?? []).filter((s) => {
      const a = asignaciones[s.parsed.sheetName];
      return a?.chofer_id && a?.camion_id && s.parsed.items.length > 0;
    }).length;
  }, [preview, asignaciones]);

  const viajesAImportar = useMemo(() => {
    if (!preview) return 0;
    return (preview.sheets ?? []).reduce((acc, s) => {
      const a = asignaciones[s.parsed.sheetName];
      return acc + (a?.chofer_id && a?.camion_id ? s.parsed.items.length : 0);
    }, 0);
  }, [preview, asignaciones]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} />
        Importar hoja de ruta
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          className={
            step === "preview"
              ? "sm:max-w-[1240px] max-h-[90vh] flex flex-col"
              : "sm:max-w-[560px]"
          }
        >
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              {step === "preview"
                ? "Vista previa — Hojas de ruta"
                : step === "done"
                ? "Importación completada"
                : "Importar hojas de ruta (Excel)"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí el .xlsx que arma Bárbara. Cada sheet del archivo corresponde a un chofer.
                  Vas a poder revisar y corregir antes de confirmar.
                </>
              )}
              {step === "preview" && preview && (
                <>
                  <span className="text-[#047857] font-semibold">
                    {preview.summary?.sheetsOk ?? 0} OK
                  </span>
                  {(preview.summary?.sheetsConWarning ?? 0) > 0 && (
                    <>
                      {" "}·{" "}
                      <span className="text-[#92400E] font-semibold">
                        {preview.summary?.sheetsConWarning} con warning
                      </span>
                    </>
                  )}
                  {(preview.summary?.sheetsConError ?? 0) > 0 && (
                    <>
                      {" "}·{" "}
                      <span className="text-red-600 font-semibold">
                        {preview.summary?.sheetsConError} con error
                      </span>
                    </>
                  )}
                  {" "}· Total: {preview.summary?.totalItems ?? 0} viajes en {preview.summary?.totalSheets ?? 0} sheets
                </>
              )}
              {step === "done" && result?.imported && (
                <>
                  {result.imported.hojasRuta} hojas de ruta · {result.imported.viajes} viajes ·{" "}
                  {result.imported.puntosCreados} puntos nuevos
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Cómo funciona:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Cada sheet del Excel = un chofer (apellido en el nombre del sheet).</li>
                  <li>Detección automática de chofer y camión por sistema.</li>
                  <li>Casos ambiguos los resolvés en el preview.</li>
                  <li>Viajes asignados al cliente <strong>&quot;Sin asignar (import)&quot;</strong> — reasignar después.</li>
                </ul>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
                required
              />
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando..." : "Analizar archivo"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "preview" && preview && (
            <PreviewStep
              preview={preview}
              activeSheet={activeSheet}
              setActiveSheet={setActiveSheet}
              asignaciones={asignaciones}
              setAsignaciones={setAsignaciones}
              onBack={reset}
              onConfirm={handleConfirm}
              loading={loading}
              listos={listos}
              viajesAImportar={viajesAImportar}
              error={error}
            />
          )}

          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div>
                  <strong>{result.imported?.hojasRuta ?? 0}</strong> hojas de ruta creadas/actualizadas
                </div>
                <div>
                  <strong>{result.imported?.viajes ?? 0}</strong> viajes insertados
                </div>
                <div>
                  <strong>{result.imported?.puntosCreados ?? 0}</strong> puntos de ruta nuevos
                </div>
                {(result.imported?.sheetsOmitidos ?? 0) > 0 && (
                  <div className="text-[#92400E]">
                    {result.imported?.sheetsOmitidos} sheets omitidos (sin asignación válida)
                  </div>
                )}
                {(result.errores?.length ?? 0) > 0 && (
                  <ul className="text-xs text-red-600 max-h-32 overflow-y-auto list-disc list-inside pt-2 border-t border-[#BAE6FD] mt-2">
                    {result.errores!.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        <strong>{e.sheet}:</strong> {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Preview step — sidebar de sheets + detalle del sheet activo
// ============================================================================

function PreviewStep({
  preview,
  activeSheet,
  setActiveSheet,
  asignaciones,
  setAsignaciones,
  onBack,
  onConfirm,
  loading,
  listos,
  viajesAImportar,
  error,
}: {
  preview: NonNullable<HojaRutaPreviewState>;
  activeSheet: string | null;
  setActiveSheet: (n: string) => void;
  asignaciones: Record<string, { chofer_id: string | null; camion_id: string | null }>;
  setAsignaciones: React.Dispatch<
    React.SetStateAction<Record<string, { chofer_id: string | null; camion_id: string | null }>>
  >;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  listos: number;
  viajesAImportar: number;
  error: string | null;
}) {
  const sheets = preview.sheets ?? [];
  const active = sheets.find((s) => s.parsed.sheetName === activeSheet);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
      {/* Banner global */}
      {(preview.puntosNuevos?.length ?? 0) > 0 && (
        <div className="rounded-md border border-[#BAE6FD] bg-[#F0F9FF] text-[#075985] text-xs px-3 py-2 flex items-center gap-2 shrink-0">
          <Info size={14} />
          Se van a crear <strong>{preview.puntosNuevos!.length}</strong> puntos de ruta nuevos:{" "}
          <span className="font-mono text-[10px] truncate">
            {preview.puntosNuevos!.slice(0, 10).join(", ")}
            {preview.puntosNuevos!.length > 10 && ` … +${preview.puntosNuevos!.length - 10} más`}
          </span>
        </div>
      )}
      {(preview.patentesPlantilla?.length ?? 0) > 0 && (
        <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2 flex items-center gap-2 shrink-0">
          <AlertTriangle size={14} />
          Patentes que aparecen en muchos sheets (probable plantilla):{" "}
          <strong className="font-mono">{preview.patentesPlantilla!.join(", ")}</strong>. Se ignoran como pista.
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Sidebar */}
        <div className="w-[260px] shrink-0 border border-border rounded-md overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 border-b border-border shrink-0">
            {sheets.length} sheets
          </div>
          <div className="overflow-y-auto flex-1">
            {sheets.map((s) => {
              const a = asignaciones[s.parsed.sheetName];
              const isActive = s.parsed.sheetName === activeSheet;
              const ready = !!a?.chofer_id && !!a?.camion_id && s.parsed.items.length > 0;
              const hasError = s.errors.length > 0;
              const hasWarning = s.warnings.length > 0;
              return (
                <button
                  type="button"
                  key={s.parsed.sheetName}
                  onClick={() => setActiveSheet(s.parsed.sheetName)}
                  className={`w-full text-left px-3 py-2 text-xs border-b border-border flex items-center justify-between gap-2 transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-muted/40"
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <StatusDot
                      kind={hasError ? "error" : ready ? "ok" : hasWarning ? "warning" : "neutral"}
                    />
                    <span className="font-medium">{s.parsed.apellido}</span>
                  </span>
                  <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">
                    {s.parsed.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 border border-border rounded-md flex flex-col">
          {active ? (
            <SheetDetail
              sheet={active}
              choferes={preview.choferes ?? []}
              camiones={preview.camiones ?? []}
              asignacion={asignaciones[active.parsed.sheetName]}
              onChange={(next) =>
                setAsignaciones((prev) => ({ ...prev, [active.parsed.sheetName]: next }))
              }
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Elegí un sheet de la lista.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg shrink-0">
          {error}
        </div>
      )}

      <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2 shrink-0">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Volver
        </Button>
        <Button
          type="button"
          variant="brand"
          onClick={onConfirm}
          disabled={loading || listos === 0}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {loading
            ? "Importando..."
            : `Confirmar ${viajesAImportar} viajes (${listos} sheets)`}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============================================================================
// Detalle de un sheet
// ============================================================================

function SheetDetail({
  sheet,
  choferes,
  camiones,
  asignacion,
  onChange,
}: {
  sheet: SheetPreview;
  choferes: NonNullable<HojaRutaPreviewState>["choferes"];
  camiones: NonNullable<HojaRutaPreviewState>["camiones"];
  asignacion: Asignacion | undefined;
  onChange: (next: Asignacion) => void;
}) {
  const choferesList = choferes ?? [];
  const camionesList = camiones ?? [];

  const handleChoferChange = (chofer_id: string) => {
    const ch = choferesList.find((c) => c.id === chofer_id);
    onChange({
      chofer_id: chofer_id || null,
      camion_id: ch?.camion?.id ?? asignacion?.camion_id ?? null,
    });
  };

  const handleCamionChange = (camion_id: string) => {
    onChange({ chofer_id: asignacion?.chofer_id ?? null, camion_id: camion_id || null });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 shrink-0 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet size={14} className="text-primary" />
          <span className="font-semibold">{sheet.parsed.apellido}</span>
          <span className="text-muted-foreground/80 text-xs">
            ({sheet.parsed.items.length} viajes
            {sheet.parsed.periodoDesde && (
              <>
                {" "}· {sheet.parsed.periodoDesde} → {sheet.parsed.periodoHasta}
              </>
            )}
            )
          </span>
          {sheet.parsed.patentesExcel.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground/70 font-mono">
              Excel: {sheet.parsed.patentesExcel.join(", ")}
            </span>
          )}
        </div>

        {/* Errors */}
        {sheet.errors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-xs px-2.5 py-1.5 flex items-start gap-1.5">
            <XCircle size={12} className="shrink-0 mt-0.5" />
            <div>
              {sheet.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {sheet.warnings.length > 0 && (
          <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-2.5 py-1.5 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <div>
              {sheet.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </div>
        )}

        {/* Asignaciones */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <User size={10} /> Chofer
            </span>
            <select
              value={asignacion?.chofer_id ?? ""}
              onChange={(e) => handleChoferChange(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
            >
              <option value="">— Saltear este sheet —</option>
              {choferesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apellido}, {c.nombre}
                  {c.camion && ` [${c.camion.patente}]`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <Truck size={10} /> Camión
            </span>
            <select
              value={asignacion?.camion_id ?? ""}
              onChange={(e) => handleCamionChange(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
            >
              <option value="">— Sin camión, saltear —</option>
              {camionesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.patente}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 sticky top-0">
            <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wide">
              <th className="px-2 py-1.5">Día</th>
              <th className="px-2 py-1.5">Origen</th>
              <th className="px-2 py-1.5">Destino</th>
              <th className="px-2 py-1.5 text-right">KM</th>
              <th className="px-2 py-1.5 text-right">29t</th>
              <th className="px-2 py-1.5 text-right">35t</th>
              <th className="px-2 py-1.5 text-right">37.5t</th>
              <th className="px-2 py-1.5">Remito</th>
              <th className="px-2 py-1.5">Material</th>
              <th className="px-2 py-1.5 text-right">$</th>
            </tr>
          </thead>
          <tbody>
            {sheet.parsed.items.slice(0, 200).map((it, i) => (
              <tr
                key={i}
                className={`border-t border-[#F1F5F9] ${
                  it.viaje_vacio ? "bg-muted/30 text-muted-foreground" : ""
                }`}
              >
                <td className="px-2 py-1 font-mono">{it.dia}</td>
                <td className="px-2 py-1">{it.sale_de}</td>
                <td className="px-2 py-1">{it.llega_a}</td>
                <td className="px-2 py-1 text-right font-mono">{it.km_recorridos}</td>
                <td className="px-2 py-1 text-right font-mono">{it.tn_com_29 ?? "—"}</td>
                <td className="px-2 py-1 text-right font-mono">{it.tn_esc_35 ?? "—"}</td>
                <td className="px-2 py-1 text-right font-mono">{it.tn_esc_37_5 ?? "—"}</td>
                <td className="px-2 py-1 font-mono text-[10px]">
                  {it.remito_numero ?? (it.viaje_vacio ? "VACÍO" : "—")}
                </td>
                <td className="px-2 py-1">{it.material ?? "—"}</td>
                <td className="px-2 py-1 text-right font-mono">
                  {it.monto_chofer != null ? it.monto_chofer.toLocaleString("es-AR") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sheet.parsed.items.length > 200 && (
          <p className="text-xs text-muted-foreground px-2 py-2 italic">
            Mostrando primeras 200 de {sheet.parsed.items.length}.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Visual helpers
// ============================================================================

function StatusDot({ kind }: { kind: "ok" | "warning" | "error" | "neutral" }) {
  if (kind === "ok") return <CheckCircle2 size={12} className="text-[#10B981]" />;
  if (kind === "warning") return <AlertTriangle size={12} className="text-[#F59E0B]" />;
  if (kind === "error") return <XCircle size={12} className="text-red-500" />;
  return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />;
}
