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
import { formatFecha } from "@/lib/utils";
import {
  Upload,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
} from "lucide-react";
import {
  previewHojaRutaImportAction,
  confirmHojaRutaImportAction,
  type HojaRutaPreviewState,
  type ConfirmHojaRutaState,
  type AsignacionSheet,
} from "../import-hoja-ruta/actions";
import HojaRutaPreviewPanel, {
  OMITIR_SHEET,
  contarFuturasImportables,
  contarImportables,
  filasFueraDeMesImportables,
  nombreMes,
  sheetsSinChofer,
  sheetsMissingSinResolver,
} from "./hoja-ruta-preview";

type Step = "select" | "preview" | "done";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const entero = (n: number) => Math.round(n).toLocaleString("es-AR");

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
  // Fechas posteriores a hoy = typo en el Excel. Vienen destildadas: dejar una
  // fila afuera lo decide el usuario, no el importador.
  const [omitirFuturas, setOmitirFuturas] = useState(false);
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
      setOmitirFuturas(false);
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
      fd.set("omitirFechasFuturas", omitirFuturas ? "1" : "0");
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
    setOmitirFuturas(false);
    fileObjRef.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  const s = preview?.summary;
  const sheets = preview?.sheets ?? [];
  const futurasADescontar = omitirFuturas
    ? contarFuturasImportables(preview?.filasFuturas ?? [], asignaciones)
    : 0;
  const importables = contarImportables(sheets, asignaciones) - futurasADescontar;
  const sinAsignar = sheetsSinChofer(sheets, asignaciones).length;
  const bloqueantes = sheetsMissingSinResolver(sheets, asignaciones).length;
  const periodo =
    s?.fechaMin && s?.fechaMax
      ? `${formatFecha(s.fechaMin)} → ${formatFecha(s.fechaMax)}`
      : null;
  // Filas con fecha de otro mes que van a entrar. Entran igual —el dato del
  // Excel no se toca— pero se guardan con SU fecha, así que después no salen al
  // filtrar por el mes del archivo. Ver FueraDelMes en hoja-ruta-preview.
  const fueraDeMes = filasFueraDeMesImportables(
    preview?.filasFueraDeMes ?? [],
    asignaciones,
  ).length;

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
        {/* El preview es una tabla de 9 columnas y 63 filas: ahí el ancho es la
            función, no la decoración. Elegir el archivo y el resultado final son
            dos párrafos, y a 1200px de ancho se leerían como un cartel. */}
        <DialogContent
          className={`flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[92vh] ${
            step === "preview" ? "sm:max-w-[1200px]" : "sm:max-w-[680px]"
          }`}
        >
          <DialogHeader>
            {/* `pr-8`: el botón de cerrar está absoluto arriba a la derecha y en
                celular el título le pasaba por debajo. */}
            <DialogTitle className="flex items-center gap-2 pr-8 text-foreground text-lg sm:text-xl">
              <FileSpreadsheet size={18} className="shrink-0 text-primary" />
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
                  <span className="font-semibold text-[#047857]">
                    {entero(importables)} viajes a importar
                  </span>
                  {(s?.totalDuplicados ?? 0) > 0 && (
                    <> · <span className="text-muted-foreground">{s?.totalDuplicados} duplicados</span></>
                  )}
                  {sinAsignar > 0 && (
                    <> · <span className="font-semibold text-[#B91C1C]">{sinAsignar} pestañas sin chofer</span></>
                  )}
                  {" "}· {money(s?.totalImporte)} total
                  {periodo && <> · {periodo}</>}
                  {fueraDeMes > 0 && (
                    <>
                      {" "}·{" "}
                      <span className="text-muted-foreground">
                        {fueraDeMes} de otro mes
                      </span>
                    </>
                  )}
                </>
              )}
              {step === "done" && result?.imported && (
                <>
                  {result.imported.viajes} viajes creados
                  {result.imported.pendientesFacturar > 0 && (
                    <> · <span className="font-semibold text-[#B45309]">{result.imported.pendientesFacturar} sin importe</span></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* ─────────── STEP 1: select file ─────────── */}
          {step === "select" && (
            <form onSubmit={handlePreview} className="space-y-4 py-2">
              <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <HelpCircle size={12} />
                  Cómo funciona
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
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
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:px-4 file:py-2 file:font-semibold file:text-primary hover:file:bg-[#B3E5FC]"
                required
              />
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <DialogFooter className="gap-2 border-t border-border pt-3">
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
            <>
              <HojaRutaPreviewPanel
                preview={preview}
                asignaciones={asignaciones}
                omitirFuturas={omitirFuturas}
                onOmitirFuturasChange={setOmitirFuturas}
                onAsignar={(sheetName, choferId) =>
                  setAsignaciones((prev) =>
                    prev.map((a) =>
                      a.sheetName === sheetName ? { ...a, chofer_id: choferId } : a,
                    ),
                  )
                }
              />

              {error && (
                <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>
              )}

              <DialogFooter className="shrink-0 gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={reset} disabled={loading}>Volver</Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={loading || importables === 0 || bloqueantes > 0}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {loading ? "Importando…" : `Confirmar ${entero(importables)} viajes`}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ─────────── STEP 3: done ─────────── */}
          {step === "done" && result && (
            <div className="space-y-3 py-2">
              <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex items-center gap-2 text-base font-bold text-foreground">
                  <CheckCircle2 size={18} className="text-[#10B981]" />
                  Importación completa
                </div>
                <div className="text-muted-foreground">
                  <strong className="font-semibold text-foreground">{result.imported?.viajes ?? 0}</strong> viajes
                  insertados desde <strong className="font-semibold text-foreground">{result.imported?.sheetsConfirmados ?? 0}</strong> pestañas
                </div>
                {(result.imported?.pendientesFacturar ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-[#B45309]">{result.imported?.pendientesFacturar}</strong> quedaron
                    sin importe (monto NULL). Aparecen como &quot;pendientes de facturar&quot; en /viajes.
                  </div>
                )}
                {(result.imported?.duplicados ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{result.imported?.duplicados}</strong> duplicados (ya estaban cargados)
                  </div>
                )}
                {(result.imported?.omitidos ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{result.imported?.omitidos}</strong> omitidos (pestañas sin chofer matcheado)
                  </div>
                )}
                {(result.imported?.futurasOmitidas ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{result.imported?.futurasOmitidas}</strong> con
                    fecha posterior a hoy que dejaste afuera (siguen igual en el Excel)
                  </div>
                )}
                {(result.imported?.puntosCreados ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{result.imported?.puntosCreados}</strong> puntos de ruta nuevos creados
                  </div>
                )}
                {/* Dónde quedó cada viaje. Sin esto, el mes del sistema da menos
                    que el Excel y no hay forma de saber por qué. */}
                {(result.imported?.fueraDeMes ?? 0) > 0 && (
                  <div className="text-muted-foreground">
                    <strong className="font-semibold text-foreground">{result.imported?.fueraDeMes}</strong> se
                    guardaron con fecha de otro mes ({result.imported?.porMes
                      ?.filter((m) => m.mes !== result.imported?.mesPrincipal)
                      .map((m) => `${m.viajes} en ${nombreMes(m.mes)}`)
                      .join(", ")}), así que en la Hoja de ruta mensual salen ahí y no en{" "}
                    {nombreMes(result.imported?.mesPrincipal ?? null)}.
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 border-t border-border pt-3">
                <Button type="button" variant="brand" onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
