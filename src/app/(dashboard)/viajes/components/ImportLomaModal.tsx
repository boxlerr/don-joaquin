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
  Truck,
  HelpCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  previewLomaImportAction,
  confirmLomaImportAction,
  type LomaPreviewState,
  type ConfirmLomaState,
  type RowPreview,
  type ChoferAsignacion,
} from "../import-loma/actions";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");
const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR");
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

type ImportLomaModalProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export default function ImportLomaModal({
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: ImportLomaModalProps = {}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NonNullable<LomaPreviewState> | null>(null);
  const [expedidoresLoma, setExpedidoresLoma] = useState<Set<string>>(new Set());
  const [asignaciones, setAsignaciones] = useState<ChoferAsignacion[]>([]);
  const [result, setResult] = useState<NonNullable<ConfirmLomaState> | null>(null);
  const [showRows, setShowRows] = useState(false);
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
      const res = await previewLomaImportAction(fd);
      if (!res || res.error || !res.ok) {
        setError(res?.error ?? "Error al analizar el Excel.");
        return;
      }
      setPreview(res);
      setExpedidoresLoma(
        new Set((res.expedidores ?? []).filter((e) => e.esLomaDefault).map((e) => e.nombre)),
      );
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
      fd.set("expedidoresLoma", JSON.stringify([...expedidoresLoma]));
      fd.set("asignaciones", JSON.stringify(asignaciones));
      const res = await confirmLomaImportAction(fd);
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
    setExpedidoresLoma(new Set());
    setAsignaciones([]);
    setResult(null);
    setShowRows(false);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleExpedidor = (nombre: string) =>
    setExpedidoresLoma((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });

  const setAsignacion = (nombreLoma: string, choferId: string | null) =>
    setAsignaciones((prev) =>
      prev.map((a) => (a.nombreLoma === nombreLoma ? { ...a, chofer_id: choferId } : a)),
    );

  // Resolución de chofer por nombre (para conteo "sin chofer" en vivo).
  const choferPorNombre = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of asignaciones) m.set(norm(a.nombreLoma), a.chofer_id);
    return m;
  }, [asignaciones]);

  // Conteos en vivo: dependen de qué expedidores están marcados como Loma.
  const live = useMemo(() => {
    const rows = preview?.rows ?? [];
    let nuevos = 0,
      enriquecer = 0,
      duplicados = 0,
      terceros = 0,
      importe = 0,
      sinChofer = 0;
    for (const r of rows) {
      const incluida = expedidoresLoma.has(r.expedidor || "(sin expedidor)");
      if (!incluida) {
        terceros++;
        continue;
      }
      if (r.status === "duplicado") {
        duplicados++;
        continue;
      }
      if (r.status === "enriquecer") enriquecer++;
      else nuevos++;
      importe += r.importe ?? 0;
      if (!choferPorNombre.get(norm(r.choferNombre))) sinChofer++;
    }
    return { nuevos, enriquecer, duplicados, terceros, importe, sinChofer, aImportar: nuevos + enriquecer };
  }, [preview, expedidoresLoma, choferPorNombre]);

  const choferesARevisar = [
    ...(preview?.choferesAmbiguos ?? []).map((c) => ({ ...c, missing: false })),
    ...(preview?.choferesMissing ?? []).map((n) => ({ nombreLoma: n, candidatos: [], missing: true })),
  ];

  const rowsIncluidas = useMemo(
    () => (preview?.rows ?? []).filter((r) => expedidoresLoma.has(r.expedidor || "(sin expedidor)")),
    [preview, expedidoresLoma],
  );

  return (
    <>
      {showTrigger && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Truck size={14} />
          Importar liquidación Loma
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="sm:max-w-[860px] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl flex items-center gap-2">
              <Truck size={18} className="text-primary" />
              Importar liquidación de fletes (Loma)
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {step === "select" && (
                <>
                  Subí el .xlsx que exporta Loma. Cada fila es un flete con su Nº de
                  transporte, remito, toneladas, importe, chofer y chasis.
                </>
              )}
              {step === "preview" && preview && (
                <>
                  <span className="text-[#047857] font-semibold">{live.aImportar} a importar</span>
                  {live.enriquecer > 0 && (
                    <> · <span className="text-[#075985]">{live.enriquecer} enriquecen un viaje existente</span></>
                  )}
                  {live.duplicados > 0 && (
                    <> · <span className="text-muted-foreground">{live.duplicados} duplicados</span></>
                  )}
                  {live.terceros > 0 && (
                    <> · <span className="text-muted-foreground">{live.terceros} de terceros (no se tocan)</span></>
                  )}
                  {" "}· {money(live.importe)}
                </>
              )}
              {step === "done" && result?.imported && (
                <>
                  {result.imported.creados} viajes creados
                  {result.imported.enriquecidos > 0 && (
                    <> · {result.imported.enriquecidos} enriquecidos</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* ─────────── STEP 1: select ─────────── */}
          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground inline-flex items-center gap-1.5">
                  <HelpCircle size={12} />
                  Cómo funciona
                </p>
                <ul className="list-disc list-inside space-y-0.5 mt-1">
                  <li>Una fila = un flete. Identidad: <code>Nº transporte</code> (único)</li>
                  <li>Los fletes <strong>de Loma</strong> (según expedidor) van con cliente Loma Negra; los de terceros no se tocan</li>
                  <li>Cliente, km oficiales (Distancia total) e importe salen del archivo</li>
                  <li>Si el remito ya está cargado, completa ese viaje en vez de duplicar</li>
                  <li>El chofer se cruza por nombre; el chasis por patente</li>
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
            <div className="flex flex-col flex-1 min-h-0 gap-3 py-2 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="A importar" value={`${live.aImportar}`} tone="success" />
                <Stat label="Enriquecen viaje" value={`${live.enriquecer}`} tone="info" />
                <Stat label="Duplicados" value={`${live.duplicados}`} tone="neutral" />
                <Stat label="Importe total" value={money(live.importe)} tone="info" />
              </div>

              {preview.clienteLoma ? (
                <div className="text-[11px] text-muted-foreground">
                  Cliente de los fletes de Loma:{" "}
                  <span className="font-semibold text-foreground">{preview.clienteLoma.label}</span>
                </div>
              ) : (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2">
                  No se encontró un cliente «Loma Negra». Se creará automáticamente al confirmar.
                </div>
              )}

              {preview.warnings && preview.warnings.length > 0 && (
                <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2">
                  {preview.warnings.slice(0, 3).map((w, i) => <div key={i}>· {w}</div>)}
                </div>
              )}

              {/* Clasificación por expedidor */}
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-1.5">
                  Expedidores — marcá cuáles son de Loma (los desmarcados no se importan)
                </p>
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 w-10">Loma</th>
                        <th className="text-left px-3 py-2">Expedidor</th>
                        <th className="text-right px-3 py-2">Fletes</th>
                        <th className="text-right px-3 py-2">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.expedidores?.map((e) => {
                        const checked = expedidoresLoma.has(e.nombre);
                        return (
                          <tr
                            key={e.nombre}
                            className={`cursor-pointer hover:bg-muted/30 ${checked ? "" : "opacity-50"}`}
                            onClick={() => toggleExpedidor(e.nombre)}
                          >
                            <td className="px-3 py-1.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleExpedidor(e.nombre)}
                                onClick={(ev) => ev.stopPropagation()}
                                className="accent-primary"
                              />
                            </td>
                            <td className="px-3 py-1.5 font-medium text-foreground">{e.nombre}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{num(e.filas)}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{money(e.importe)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Choferes a revisar */}
              {choferesARevisar.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-1.5 inline-flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-[#F59E0B]" />
                    Choferes a revisar ({choferesARevisar.length})
                  </p>
                  <div className="space-y-1.5">
                    {choferesARevisar.map((c) => {
                      const asignado =
                        asignaciones.find((a) => a.nombreLoma === c.nombreLoma)?.chofer_id ?? null;
                      return (
                        <div key={c.nombreLoma} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-foreground min-w-[180px]">{c.nombreLoma}</span>
                          <span className={c.missing ? "text-red-600" : "text-[#92400E]"}>
                            {c.missing ? "sin match" : "ambiguo"}
                          </span>
                          <select
                            value={asignado ?? ""}
                            onChange={(ev) =>
                              setAsignacion(c.nombreLoma, ev.target.value === "" ? null : ev.target.value)
                            }
                            className="h-7 max-w-[280px] rounded border border-border bg-card px-1.5 text-[11px] focus:border-primary outline-none"
                          >
                            <option value="">— Sin chofer (revisar después) —</option>
                            {c.candidatos.map((k) => (
                              <option key={k.id} value={k.id}>{k.label}</option>
                            ))}
                            {!c.missing && <option value="" disabled>——— Todos ———</option>}
                            {preview.choferesDisponibles
                              ?.filter((d) => !c.candidatos.some((k) => k.id === d.id))
                              .map((d) => (
                                <option key={d.id} value={d.id}>{d.label}</option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {live.sinChofer > 0 && (
                <div className="text-[11px] text-[#92400E]">
                  {live.sinChofer} fletes quedarían sin chofer asignado (se importan igual, los corregís después).
                </div>
              )}

              {/* Detalle de filas (colapsable) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowRows((v) => !v)}
                  className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                >
                  {showRows ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {showRows ? "Ocultar" : "Ver"} fletes a importar ({rowsIncluidas.length})
                </button>
                {showRows && (
                  <div className="mt-1.5 border border-border rounded-md overflow-hidden max-h-[260px] overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="sticky top-0 bg-card border-b border-border text-[9px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-2 py-1.5">Nº transp.</th>
                          <th className="text-left px-2 py-1.5">Fecha</th>
                          <th className="text-left px-2 py-1.5">Ruta</th>
                          <th className="text-left px-2 py-1.5">Remito</th>
                          <th className="text-left px-2 py-1.5">Chofer</th>
                          <th className="text-right px-2 py-1.5">Tn</th>
                          <th className="text-right px-2 py-1.5">Importe</th>
                          <th className="text-left px-2 py-1.5">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {rowsIncluidas.map((r) => (
                          <RowLine key={r.nroTransporte} r={r} resolvedChofer={choferPorNombre.get(norm(r.choferNombre)) ?? null} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg shrink-0">{error}</div>
              )}

              <DialogFooter className="pt-3 border-t border-border gap-2 shrink-0">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={loading || live.aImportar === 0}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando…" : `Confirmar ${live.aImportar} fletes`}
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
                <div><strong>{result.imported?.creados ?? 0}</strong> viajes creados</div>
                {(result.imported?.enriquecidos ?? 0) > 0 && (
                  <div><strong>{result.imported?.enriquecidos}</strong> viajes existentes enriquecidos con datos oficiales</div>
                )}
                {(result.imported?.duplicados ?? 0) > 0 && (
                  <div><strong>{result.imported?.duplicados}</strong> duplicados (ya tenían Nº transporte)</div>
                )}
                {(result.imported?.tercerosOmitidos ?? 0) > 0 && (
                  <div><strong>{result.imported?.tercerosOmitidos}</strong> fletes de terceros omitidos (no se tocaron)</div>
                )}
                {(result.imported?.sinChofer ?? 0) > 0 && (
                  <div className="text-[#92400E]"><strong>{result.imported?.sinChofer}</strong> sin chofer asignado (revisar en /viajes)</div>
                )}
                {(result.imported?.puntosCreados ?? 0) > 0 && (
                  <div><strong>{result.imported?.puntosCreados}</strong> puntos de ruta nuevos creados</div>
                )}
                {(result.imported?.sinFecha ?? 0) > 0 && (
                  <div><strong>{result.imported?.sinFecha}</strong> omitidos sin fecha de transporte</div>
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
  const cls =
    tone === "success"
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

function RowLine({ r, resolvedChofer }: { r: RowPreview; resolvedChofer: string | null }) {
  const dup = r.status === "duplicado";
  return (
    <tr className={dup ? "opacity-50" : ""}>
      <td className="px-2 py-1.5 font-mono whitespace-nowrap">{r.nroTransporte}</td>
      <td className="px-2 py-1.5 font-mono whitespace-nowrap">{r.fecha ?? "—"}</td>
      <td className="px-2 py-1.5">{r.saleDe} → {r.llegaA}</td>
      <td className="px-2 py-1.5 font-mono">{r.remito ?? "—"}</td>
      <td className="px-2 py-1.5">
        {resolvedChofer ? r.choferNombre : <span className="text-[#92400E]">{r.choferNombre || "—"} (sin match)</span>}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">{r.ton != null ? num(r.ton) : "—"}</td>
      <td className="px-2 py-1.5 text-right font-mono">{money(r.importe)}</td>
      <td className="px-2 py-1.5">
        {dup ? (
          <span className="text-muted-foreground">ya cargado</span>
        ) : r.status === "enriquecer" ? (
          <span className="text-[#075985]">enriquece</span>
        ) : (
          <span className="text-[#047857]">nuevo</span>
        )}
      </td>
    </tr>
  );
}
