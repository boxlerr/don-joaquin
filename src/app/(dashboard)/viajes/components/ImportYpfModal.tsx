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
import { Upload, Loader2, AlertTriangle, FileText, Pencil } from "lucide-react";
import {
  previewYpfImportAction,
  confirmYpfImportAction,
  type YpfPreviewState,
  type ConfirmYpfState,
  type DmRowPreview,
} from "../import-ypf/actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

// Formato argentino para las celdas editables: miles con "." y decimales con ",".
const parseNum = (d: string) => d.replace(/[^\d,]/g, "").replace(",", ".");
const fmtMoneyCell = (raw: string) =>
  raw.trim() === "" ? "" : (Number(raw.replace(",", ".")) || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const fmtTnCell = (raw: string) => raw.replace(".", ",");

// Fila editable en la preview (los inputs se manejan como string).
type EditRow = {
  idx: number;
  remito: string;
  fecha: string | null;
  destino: string | null;
  choferDm: string;
  precioUnitario: number | null;
  netoTn: string;
  importe: string;
  status: DmRowPreview["status"];
  viajeCodigo: string | null;
  viajeChofer: string | null;
  aplicar: boolean;
};

function toEdit(r: DmRowPreview): EditRow {
  return {
    idx: r.idx,
    remito: r.remito ?? "",
    fecha: r.fecha,
    destino: r.destino,
    choferDm: r.choferDm,
    precioUnitario: r.precioUnitario,
    netoTn: r.netoTn != null ? String(r.netoTn) : "",
    importe: r.importe != null ? String(Math.round(r.importe)) : "",
    status: r.status,
    viajeCodigo: r.viaje?.codigo ?? null,
    viajeChofer: r.viaje?.chofer ?? null,
    aplicar: r.status === "coincide",
  };
}

const ESTADO_INFO: Record<DmRowPreview["status"], string> = {
  coincide: "Coincide con un viaje cargado — se va a completar",
  ya_con_valor: "El viaje ya tenía un importe cargado (destildado por defecto)",
  no_cargado: "El DM trae este remito pero ningún viaje cargado lo tiene. Cargá el viaje (aunque sea sin número) o corregí acá el remito de uno que exista.",
  sin_remito: "El renglón del DM no trae número de remito",
  sin_precio: "No hay precio del destino para calcular el importe",
};

type ImportYpfModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export default function ImportYpfModal({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: ImportYpfModalProps = {}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<YpfPreviewState> | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [result, setResult] = useState<NonNullable<ConfirmYpfState> | null>(null);
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
      const res = await previewYpfImportAction(fd);
      if (!res || res.error || !res.ok) {
        setError(res?.error ?? "Error al analizar el PDF.");
        return;
      }
      setPreview(res);
      setRows((res.rows ?? []).map(toEdit));
      setStep("preview");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Editar una celda. Al cambiar las toneladas, recalcula el importe (tn × precio).
  const patchRow = (idx: number, patch: Partial<EditRow>, recalcImporte = false) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.idx !== idx) return r;
        const next = { ...r, ...patch };
        if (recalcImporte && next.precioUnitario != null) {
          const tn = Number(next.netoTn);
          if (!Number.isNaN(tn)) next.importe = String(Math.round(tn * next.precioUnitario));
        }
        return next;
      }),
    );
  };

  const aplicarCount = useMemo(() => rows.filter((r) => r.aplicar).length, [rows]);
  const totalAplicar = useMemo(
    () => rows.filter((r) => r.aplicar).reduce((s, r) => s + (Number(r.importe) || 0), 0),
    [rows],
  );
  const faltantes = useMemo(() => rows.filter((r) => r.status === "no_cargado"), [rows]);
  // Los remitos sin viaje van arriba de todo para que no queden escondidos.
  const rowsOrdenadas = useMemo(
    () => [...rows].sort((a, b) => (a.status === "no_cargado" ? 0 : 1) - (b.status === "no_cargado" ? 0 : 1)),
    [rows],
  );

  const handleConfirm = async () => {
    if (!fileObjRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const payload = rows.map((r) => ({
        remito: r.remito.trim() || null,
        netoTn: Number(r.netoTn) || 0,
        importe: r.importe.trim() === "" ? null : Number(r.importe) || 0,
        aplicar: r.aplicar,
      }));
      const fd = new FormData();
      fd.set("file", fileObjRef.current);
      fd.set("rows", JSON.stringify(payload));
      const res = await confirmYpfImportAction(fd);
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
    setRows([]);
    setResult(null);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      {showTrigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <FileText size={14} />
          Importar DM de YPF
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent
          className={step === "preview" ? "sm:max-w-[1150px] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col" : "sm:max-w-[560px]"}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg sm:text-xl">
              {step === "preview"
                ? "Vista previa — DM de YPF"
                : step === "done"
                ? "Viajes completados"
                : "Importar DM de YPF"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>Subí el PDF del DM. El sistema cruza cada renglón por <strong>nº de remito</strong> contra los viajes ya cargados. En la vista previa vas a poder <strong>revisar y editar</strong> remito, toneladas e importe antes de confirmar.</>
              )}
              {step === "preview" && preview && (
                <>
                  {preview.quincenaDesde} → {preview.quincenaHasta} ·{" "}
                  <span className="text-[#047857] font-semibold">{aplicarCount} a aplicar</span>
                  {faltantes.length > 0 && <> · <span className="text-red-600 font-semibold">{faltantes.length} sin cargar</span></>}
                  {" "}· {money(totalAplicar)} en total
                </>
              )}
              {step === "done" && result?.result && (
                <>
                  <span className="text-[#047857] font-semibold">{result.result.completados} viajes completados</span>
                  {result.result.noCargados > 0 && (
                    <> · <span className="text-red-600 font-semibold">{result.result.noCargados} a reclamar</span></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Cómo funciona:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Cruza cada viaje del DM por <strong>nº de remito</strong> con los viajes ya cargados.</li>
                  <li>Mostramos <strong>todos los viajes con sus remitos y totales</strong> — podés editarlos antes de confirmar.</li>
                  <li>A los que coinciden les completa <strong>toneladas + importe</strong> y los marca facturados.</li>
                  <li>Los remitos del DM que <strong>no estén cargados</strong> se listan arriba de todo para reclamar (no se crean solos).</li>
                  <li>El PDF firmado queda archivado en Compliance → YPF.</li>
                </ul>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
                required
              />
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Analizando..." : "Analizar DM"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "preview" && preview && (
            <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
              {(preview.warnings?.length ?? 0) > 0 && (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2 flex items-start gap-2 shrink-0">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>{preview.warnings!.map((w, i) => <div key={i}>{w}</div>)}</div>
                </div>
              )}

              {/* Remitos del DM sin viaje cargado → reclamar */}
              {faltantes.length > 0 && (
                <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] text-xs px-3 py-2 shrink-0">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    {faltantes.length} remito{faltantes.length !== 1 ? "s" : ""} del DM sin viaje cargado — a reclamar (arriba de todo en la tabla, en rojo)
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {faltantes.map((r) => (
                      <li key={r.idx} className="font-mono text-[11px]">
                        <strong>{r.remito || "—"}</strong> · {r.fecha ?? "s/f"} · {r.destino ?? "—"} · {r.choferDm || "chofer s/d"} · {r.netoTn || "—"} tn · {money(Number(r.importe) || null)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 text-[11px] text-[#991B1B]/80">
                    No hay ningún viaje cargado con esos remitos. Cargá el viaje (con esos datos) y reimportá el DM, o corregí el remito acá si el viaje existe con otro número.
                  </div>
                </div>
              )}

              {(preview.tarifas?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground shrink-0">
                  <span className="font-semibold text-foreground">Precios por destino:</span>{" "}
                  {preview.tarifas!.map((t) => `${t.destino}: ${money(t.precioUnitario)}/tn`).join("  ·  ")}
                </div>
              )}

              <div className="text-[11px] text-primary flex items-center gap-1.5 shrink-0 bg-[#E1F5FE]/60 border border-[#BAE6FD] rounded-md px-2.5 py-1.5">
                <Pencil size={12} className="shrink-0" />
                <span>
                  Las celdas con <span className="px-1 py-0.5 bg-muted/60 border border-border rounded mx-0.5 font-mono">borde gris</span> son{" "}
                  <strong>editables</strong> — tocá <strong>remito</strong>, <strong>toneladas</strong> o <strong>importe</strong> para corregir antes de confirmar.
                </span>
              </div>
              <div className="overflow-auto flex-1 min-h-0 border border-border rounded-md">
                <table className="w-full min-w-[820px] text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wide bg-card">
                      <th className="px-2 py-1.5 border-b border-border bg-card" title="Aplicar esta fila">✓</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Fecha</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">
                        <span className="inline-flex items-center gap-1">Remito <Pencil size={9} className="text-primary" /></span>
                      </th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Destino</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Chofer (DM)</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card">Viaje</th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">
                        <span className="inline-flex items-center gap-1 justify-end">Neto tn <Pencil size={9} className="text-primary" /></span>
                      </th>
                      <th className="px-2 py-1.5 border-b border-border bg-card text-right">
                        <span className="inline-flex items-center gap-1 justify-end">Importe <Pencil size={9} className="text-primary" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsOrdenadas.map((r) => (
                      <EditableDmRow key={r.idx} r={r} onPatch={patchRow} />
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg shrink-0">{error}</div>}
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2 shrink-0 items-center">
                <span className="text-xs text-muted-foreground mr-auto">
                  {aplicarCount} de {rows.length} filas · {money(totalAplicar)}
                </span>
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button type="button" variant="brand" onClick={handleConfirm} disabled={loading || aplicarCount === 0}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Completando..." : `Completar ${aplicarCount} viaje${aplicarCount !== 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "done" && result?.result && (
            <div className="space-y-3 py-2">
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] text-[#075985] text-sm rounded-lg p-3 space-y-1">
                <div><strong>{result.result.completados}</strong> viajes completados (tonelaje + importe + facturado)</div>
                {result.result.noCargados > 0 && (
                  <div className="text-red-600">
                    <strong>{result.result.noCargados}</strong> remitos del DM sin viaje cargado — <strong>a reclamar</strong>. Cargá esos viajes y volvé a importar el DM.
                  </div>
                )}
                {result.result.yaTenian > 0 && (
                  <div className="text-muted-foreground"><strong>{result.result.yaTenian}</strong> ya tenían valor (se sobrescribieron con lo que dejaste marcado)</div>
                )}
                {((result.result.tarifasCreadas ?? 0) + (result.result.tarifasActualizadas ?? 0)) > 0 && (
                  <div className="text-[#047857]">
                    Tarifas por destino guardadas: <strong>{result.result.tarifasCreadas ?? 0}</strong> nuevas
                    {(result.result.tarifasActualizadas ?? 0) > 0 && <> · <strong>{result.result.tarifasActualizadas}</strong> actualizadas</>}
                    . Ahora el alta de viajes precarga el importe por destino.
                  </div>
                )}
              </div>
              <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Celdas editables: fondo tenue + borde visible para que se lea claramente como
// un campo (no como texto plano). Resaltan al pasar el mouse y al enfocar.
const cellInput =
  "w-full bg-muted/40 border border-border rounded-md px-1.5 py-1 font-mono text-foreground cursor-text transition-colors hover:bg-card hover:border-[#60A5FA] focus:border-primary focus:ring-2 focus:ring-primary/25 focus:bg-card outline-none";

function EditableDmRow({
  r,
  onPatch,
}: {
  r: EditRow;
  onPatch: (idx: number, patch: Partial<EditRow>, recalc?: boolean) => void;
}) {
  const reclama = r.status === "no_cargado";
  const rowCls = reclama ? "bg-red-50/60" : r.status === "sin_remito" || r.status === "sin_precio" ? "bg-[#FFFBEB]/60" : "";

  return (
    <tr className={`border-t border-[#F1F5F9] ${rowCls}`}>
      <td className="px-2 py-1 text-center">
        <input
          type="checkbox"
          checked={r.aplicar}
          onChange={(e) => onPatch(r.idx, { aplicar: e.target.checked })}
          className="accent-primary align-middle"
          title="Aplicar esta fila al confirmar"
        />
      </td>
      <td className="px-2 py-1 font-mono text-muted-foreground whitespace-nowrap">{r.fecha ?? "—"}</td>
      <td className="px-1 py-0.5">
        <input
          value={r.remito}
          onChange={(e) => onPatch(r.idx, { remito: e.target.value })}
          className={`${cellInput} w-24 ${reclama ? "text-red-600 font-bold" : ""}`}
          placeholder="—"
        />
      </td>
      <td className="px-2 py-1 whitespace-nowrap">{r.destino ?? "—"}</td>
      <td className="px-2 py-1 whitespace-nowrap truncate max-w-[160px]" title={r.choferDm || undefined}>
        {r.choferDm || "—"}
      </td>
      <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap" title={ESTADO_INFO[r.status]}>
        {r.viajeCodigo ? (
          <span className="text-primary" title={r.viajeChofer ?? undefined}>{r.viajeCodigo}</span>
        ) : reclama ? (
          <span className="text-red-600 italic">✗ falta cargar</span>
        ) : r.status === "ya_con_valor" ? (
          <span className="text-muted-foreground italic">ya tenía valor</span>
        ) : (
          <span className="text-[#92400E] italic">{r.status === "sin_precio" ? "sin precio" : "sin remito"}</span>
        )}
      </td>
      <td className="px-1 py-0.5 text-right">
        <input
          value={fmtTnCell(r.netoTn)}
          onChange={(e) => onPatch(r.idx, { netoTn: parseNum(e.target.value) }, true)}
          inputMode="decimal"
          className={`${cellInput} w-16 text-right`}
        />
      </td>
      <td className="px-1 py-0.5 text-right">
        <div className="flex items-center justify-end">
          <span className="text-muted-foreground pr-0.5">$</span>
          <input
            value={fmtMoneyCell(r.importe)}
            onChange={(e) => onPatch(r.idx, { importe: parseNum(e.target.value) })}
            inputMode="decimal"
            className={`${cellInput} w-28 text-right ${r.aplicar ? "font-bold text-[#047857]" : ""}`}
          />
        </div>
      </td>
    </tr>
  );
}
