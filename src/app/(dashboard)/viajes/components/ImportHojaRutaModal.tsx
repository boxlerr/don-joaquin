"use client";

import { useRef, useState } from "react";
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
  FileSpreadsheet,
  HelpCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  previewHojaRutaImportAction,
  confirmHojaRutaImportAction,
  type HojaRutaPreviewState,
  type ConfirmHojaRutaState,
  type SheetPreview,
  type SheetViajePreview,
  type AsignacionSheet,
} from "../import-hoja-ruta/actions";

type Step = "select" | "preview" | "done";

// Sentinel local del preview: el usuario decidió explícitamente NO importar un
// sheet cuyo chofer no existe en Legajos (se manda como null al confirmar). Un
// sheet missing sin decisión bloquea la confirmación (caso «Goiti», 02/07).
const OMITIR_SHEET = "__omitir__";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR");

type ImportHojaRutaModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export default function ImportHojaRutaModal({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: ImportHojaRutaModalProps = {}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<HojaRutaPreviewState> | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionSheet[]>([]);
  const [result, setResult] = useState<NonNullable<ConfirmHojaRutaState> | null>(null);
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
        setError(res?.error ?? "Error al analizar el Excel.");
        return;
      }
      setPreview(res);
      setAsignaciones(res.asignaciones ?? []);
      setStep("preview");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el Excel.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!fileObjRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", fileObjRef.current);
      // El sentinel OMITIR_SHEET es solo del preview: al server va como null (saltear).
      const payload: AsignacionSheet[] = asignaciones.map((a) => ({
        ...a,
        chofer_id: a.chofer_id === OMITIR_SHEET ? null : a.chofer_id,
      }));
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
    setAsignaciones([]);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = preview?.summary;

  const asignadoDe = (sheetName: string) =>
    asignaciones.find((a) => a.sheetName === sheetName)?.chofer_id ?? null;

  const setAsignacion = (sheetName: string, choferId: string | null) =>
    setAsignaciones((prev) =>
      prev.map((a) => (a.sheetName === sheetName ? { ...a, chofer_id: choferId } : a)),
    );

  // Pestañas desplegadas (click → ver viajes).
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const toggleExpand = (sheetName: string) =>
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(sheetName)) next.delete(sheetName);
      else next.add(sheetName);
      return next;
    });

  // Conteos: dependen del match automático (determinístico).
  const choferRealDe = (sheetName: string) => {
    const a = asignadoDe(sheetName);
    return a && a !== OMITIR_SHEET ? a : null;
  };
  const importablesLive = (preview?.sheets ?? []).reduce(
    (acc, sh) => acc + (choferRealDe(sh.sheetName) ? sh.total - sh.yaImportados : 0),
    0,
  );
  const sinAsignar = (preview?.sheets ?? []).filter((sh) => !choferRealDe(sh.sheetName)).length;
  // Sheets con chofer inexistente y sin decisión del usuario: bloquean el import.
  const missingSinResolver = (preview?.sheets ?? []).filter(
    (sh) => sh.chofer.status === "missing" && !asignadoDe(sh.sheetName),
  );

  return (
    <>
      {showTrigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <FileSpreadsheet size={14} />
          Importar HOJA DE RUTA
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="sm:max-w-[820px] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-primary" />
              Importar HOJA DE RUTA (Excel)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí el .xlsx (&quot;HOJA DE RUTA completa&quot;). Cada sheet es un chofer.
                  El sistema cruza por apellido, dedup contra los viajes ya cargados
                  y carga los que tengan datos válidos.
                </>
              )}
              {step === "preview" && preview && (
                <>
                  <span className="text-[#047857] font-semibold">{importablesLive} viajes a importar</span>
                  {(s?.totalDuplicados ?? 0) > 0 && (
                    <> · <span className="text-muted-foreground">{s?.totalDuplicados} duplicados</span></>
                  )}
                  {sinAsignar > 0 && (
                    <> · <span className="text-red-600 font-semibold">{sinAsignar} sheets sin chofer</span></>
                  )}
                  {" "}· {money(s?.totalImporte)} total
                </>
              )}
              {step === "done" && result?.imported && (
                <>
                  {result.imported.viajes} viajes creados
                  {result.imported.pendientesFacturar > 0 && (
                    <> · <span className="text-[#92400E] font-semibold">{result.imported.pendientesFacturar} sin importe</span></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* ─────────── STEP 1: select file ─────────── */}
          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
                  <HelpCircle size={12} />
                  Cómo funciona
                </p>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Cada sheet del Excel = un chofer (cruce por apellido)</li>
                  <li>Estructura esperada: DIA · SALE DE · LLEGA A · KM · Tn 29/35/37,5 · Nº REMITO · MATERIAL · KM VACÍOS · $</li>
                  <li>Viajes sin <code>$</code> se cargan con monto NULL = pendientes de facturar</li>
                  <li>La columna <code>REMITO Nº</code> se toma tal cual: si está en blanco o dice VACIO, el viaje es vacío</li>
                  <li>Dedup por (chofer + fecha + remito): no se duplican viajes ya cargados por el importador YPF</li>
                  <li>Si el chofer de un sheet no está dado de alta en Legajos, el import se bloquea: dalo de alta en Choferes → Legajos y volvé a analizar (o asignale un chofer existente en el preview)</li>
                  <li>Sheets ignorados: TOTALES, HOJA DE GASTOS, FISCHER y PABLO FISCHER (fleteros, otro formato), TOTAL, Hoja1</li>
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
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
              )}
              <DialogFooter className="pt-3 border-t border-border gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando…" : "Analizar archivo"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* ─────────── STEP 2: preview ─────────── */}
          {step === "preview" && preview && (
            <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
              {/* Resumen agregado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Sheets con chofer" value={`${(s?.totalSheets ?? 0) - sinAsignar} / ${s?.totalSheets ?? 0}`} tone="info" />
                <Stat label="Viajes a importar" value={`${importablesLive}`} tone="success" />
                <Stat label="Duplicados" value={`${s?.totalDuplicados ?? 0}`} tone="neutral" />
                <Stat label="Total importe" value={money(s?.totalImporte)} tone="info" />
              </div>

              {preview.warnings && preview.warnings.length > 0 && (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2">
                  {preview.warnings.slice(0, 3).map((w, i) => <div key={i}>· {w}</div>)}
                </div>
              )}

              {/* Listado de sheets */}
              <div className="overflow-y-auto flex-1 min-h-0 border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60 border-b border-border">
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">Sheet → Chofer</th>
                      <th className="text-right px-3 py-2">Viajes</th>
                      <th className="text-right px-3 py-2">Vacíos</th>
                      <th className="text-right px-3 py-2" title="Viajes sin importe (pendientes de facturar)">Pend.</th>
                      <th className="text-right px-3 py-2">Dup.</th>
                      <th className="text-right px-3 py-2">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.sheets?.map((sh) => (
                      <SheetRow
                        key={sh.sheetName}
                        sheet={sh}
                        asignado={asignadoDe(sh.sheetName)}
                        choferesDisponibles={preview.choferesDisponibles ?? []}
                        onAsignar={(id) => setAsignacion(sh.sheetName, id)}
                        expanded={expandidas.has(sh.sheetName)}
                        onToggle={() => toggleExpand(sh.sheetName)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {missingSinResolver.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg shrink-0">
                  {missingSinResolver.map((sh) => `«${sh.sheetName.trim()}»`).join(", ")} no
                  corresponde a ningún chofer dado de alta. Cargalo en Choferes → Legajos y
                  volvé a analizar el archivo, o resolvelo en la tabla (asignar chofer / omitir sheet).
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg shrink-0">{error}</div>
              )}

              <DialogFooter className="pt-3 border-t border-border gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={loading || importablesLive === 0 || missingSinResolver.length > 0}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando…" : `Confirmar ${importablesLive} viajes`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ─────────── STEP 3: done ─────────── */}
          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-4 space-y-1">
                <div className="flex items-center gap-2 text-base font-bold">
                  <CheckCircle2 size={18} className="text-[#10B981]" />
                  Importación completa
                </div>
                <div><strong>{result.imported?.viajes ?? 0}</strong> viajes insertados desde <strong>{result.imported?.sheetsConfirmados ?? 0}</strong> sheets</div>
                {(result.imported?.pendientesFacturar ?? 0) > 0 && (
                  <div className="text-[#92400E]">
                    <strong>{result.imported?.pendientesFacturar}</strong> quedaron sin importe (monto NULL).
                    Aparecen como &quot;pendientes de facturar&quot; en /viajes.
                  </div>
                )}
                {(result.imported?.duplicados ?? 0) > 0 && (
                  <div><strong>{result.imported?.duplicados}</strong> duplicados (ya estaban cargados)</div>
                )}
                {(result.imported?.omitidos ?? 0) > 0 && (
                  <div><strong>{result.imported?.omitidos}</strong> omitidos (sheets sin chofer matcheado)</div>
                )}
                {(result.imported?.puntosCreados ?? 0) > 0 && (
                  <div><strong>{result.imported?.puntosCreados}</strong> puntos de ruta nuevos creados</div>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-border gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "neutral";
}) {
  const cls = tone === "success"
    ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
    : tone === "info"
    ? "bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]"
    : "bg-muted/40 border-border text-muted-foreground";
  return (
    <div className={`border rounded-md px-3 py-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  );
}

function SheetRow({
  sheet,
  asignado,
  choferesDisponibles,
  onAsignar,
  expanded,
  onToggle,
}: {
  sheet: SheetPreview;
  asignado: string | null;
  choferesDisponibles: { id: string; label: string }[];
  onAsignar: (choferId: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isAmbig = sheet.chofer.status === "ambiguo";
  const isMissing = sheet.chofer.status === "missing";
  const candidatos = sheet.chofer.status === "ambiguo" ? sheet.chofer.candidatos : [];
  const omitido = asignado === OMITIR_SHEET;
  const resuelto = !!asignado && !omitido;
  const importables = resuelto ? sheet.total - sheet.yaImportados : 0;

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-muted/30 ${!resuelto && !omitido ? (isMissing ? "bg-red-50/40" : "bg-amber-50/40") : ""}`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 align-top">
          <div className="flex items-center gap-1">
            {expanded ? (
              <ChevronDown size={13} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={13} className="text-muted-foreground" />
            )}
            {resuelto ? (
              <CheckCircle2 size={13} className="text-[#10B981]" />
            ) : omitido ? (
              <XCircle size={13} className="text-muted-foreground" />
            ) : isAmbig ? (
              <AlertTriangle size={13} className="text-[#F59E0B]" />
            ) : (
              <XCircle size={13} className="text-red-500" />
            )}
          </div>
        </td>
        <td className="px-3 py-2 align-top">
          <div className="font-mono font-semibold text-foreground">{sheet.sheetName.trim() || "(sin nombre)"}</div>
          {sheet.chofer.status === "ok" && (
            <div className="text-muted-foreground">→ {sheet.chofer.apellido}, {sheet.chofer.nombre}</div>
          )}
          {(isAmbig || isMissing) && (
            <div className="mt-1 space-y-0.5" onClick={(e) => e.stopPropagation()}>
              {isAmbig && (
                <div className="text-[#92400E]">→ ambiguo · {candidatos.map((c) => c.label).join(" / ")}</div>
              )}
              {isMissing && (
                <div className="text-red-600">
                  → no está dado de alta en Legajos — cargalo en Choferes → Legajos y volvé a analizar
                </div>
              )}
              <select
                value={asignado ?? ""}
                onChange={(e) => onAsignar(e.target.value === "" ? null : e.target.value)}
                className="h-7 max-w-[260px] rounded border border-border bg-card px-1.5 text-[11px] focus:border-primary outline-none"
              >
                {isMissing ? (
                  <>
                    <option value="">— Elegir qué hacer… —</option>
                    <option value={OMITIR_SHEET}>Omitir este sheet (no importar sus viajes)</option>
                  </>
                ) : (
                  <option value="">— Omitir este sheet —</option>
                )}
                {candidatos.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
                <option value="" disabled>
                  ——— Todos los choferes ———
                </option>
                {choferesDisponibles
                  .filter((c) => !candidatos.some((k) => k.id === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
              </select>
            </div>
          )}
          {sheet.patentes.length > 0 && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">
              Patentes: <span className="font-mono">{sheet.patentes.join(" · ")}</span>
            </div>
          )}
          {sheet.warnings.map((w, i) => (
            <div key={i} className="text-[10px] text-[#92400E] italic">⚠ {w}</div>
          ))}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono">
          <span className="font-semibold">{importables}</span>
          <span className="text-muted-foreground/60"> / {sheet.total}</span>
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">{num(sheet.vacios)}</td>
        <td className="px-3 py-2 text-right align-top font-mono">
          {sheet.pendientesFacturar > 0 ? (
            <span className="text-[#92400E] font-semibold">{sheet.pendientesFacturar}</span>
          ) : (
            <span className="text-muted-foreground/60">0</span>
          )}
        </td>
        <td className="px-3 py-2 text-right align-top font-mono text-muted-foreground">{num(sheet.yaImportados)}</td>
        <td className="px-3 py-2 text-right align-top font-mono">{money(sheet.sumaImporte)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-3 pb-3 pt-0 bg-muted/20">
            <ViajesDetalle viajes={sheet.viajes} />
          </td>
        </tr>
      )}
    </>
  );
}

function ViajesDetalle({ viajes }: { viajes: SheetViajePreview[] }) {
  if (viajes.length === 0) {
    return <div className="text-[11px] text-muted-foreground py-2">Sin viajes en esta pestaña.</div>;
  }
  return (
    <div className="border border-border rounded-md overflow-hidden mt-1">
      <table className="w-full text-[11px]">
        <thead className="bg-card border-b border-border text-[9px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5">Día</th>
            <th className="text-left px-2 py-1.5">Ruta</th>
            <th className="text-right px-2 py-1.5">Km</th>
            <th className="text-left px-2 py-1.5">Remito</th>
            <th className="text-left px-2 py-1.5">Material</th>
            <th className="text-right px-2 py-1.5">Tn</th>
            <th className="text-right px-2 py-1.5">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {viajes.map((v, i) => (
            <tr
              key={i}
              title={v.dup ? "Ya estaba cargado — no se vuelve a importar" : undefined}
              className={v.dup ? "opacity-50 line-through" : ""}
            >
              <td className="px-2 py-1.5 font-mono whitespace-nowrap">{v.fecha}</td>
              <td className="px-2 py-1.5">{v.saleDe} → {v.llegaA}</td>
              <td className="px-2 py-1.5 text-right font-mono">{v.km != null ? num(v.km) : "—"}</td>
              <td className="px-2 py-1.5 font-mono">
                {v.vacio ? (
                  // Igual que la planilla Excel del cliente y la hoja de ruta: "VACIO" en rojo.
                  <span className="text-[#C00000] font-bold">VACIO</span>
                ) : (
                  v.remito
                )}
              </td>
              <td className="px-2 py-1.5">{v.material ?? "—"}</td>
              <td className="px-2 py-1.5 text-right font-mono">{v.ton != null ? num(v.ton) : "—"}</td>
              <td className="px-2 py-1.5 text-right font-mono">{v.vacio ? "—" : money(v.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
