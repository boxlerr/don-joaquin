"use client";

// Diálogo "Importar Excel" de Sueldos. Reconoce SOLO los dos archivos que existen:
//
//   * La nómina del mes ("IMPORTES SUELDOS JULIO 2026"): cuánto se le transfirió
//     a cada persona y por qué banco. Es el que manda Bárbara todos los meses.
//   * La planilla de admin y taller (bloques por mes con sueldo, comisión,
//     combustible, plus YPF y sábados).
//
// El formato se reconoce solo. Antes había que saber cuál es cuál y elegirlo de
// una lista: son dos archivos parecidos con nombres parecidos, y equivocarse
// cargaba los importes de la nómina como si fueran sueldos base.
//
// Pasos: elegir archivo → revisar → resultado.

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
import { Upload, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  previewImportSueldosAction,
  confirmImportSueldosAction,
  type SueldosImportPreview,
  type SueldosImportResult,
} from "./import-actions";
import {
  previewImportNominaAction,
  confirmImportNominaAction,
} from "./import-nomina-actions";
import type { NominaImportPreview, NominaImportResult } from "./nomina-tipos";
import ImportNominaPreview from "./ImportNominaPreview";

type Step = "select" | "preview" | "done";
type Formato = "nomina" | "planilla";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

const MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MESES_ABR[parseInt(m, 10) - 1]} ${y}`;
};

const ROL_LABEL: Record<string, string> = {
  administrativo: "Administración",
  mantenimiento: "Taller",
  chofer: "Chofer",
};

export default function ImportSueldosDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [formato, setFormato] = useState<Formato | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Planilla de admin y taller.
  const [preview, setPreview] = useState<Extract<SueldosImportPreview, { ok: true }> | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Extract<SueldosImportResult, { ok: true }> | null>(null);

  // Nómina del mes.
  const [nomina, setNomina] = useState<Extract<NominaImportPreview, { ok: true }> | null>(null);
  const [mesNomina, setMesNomina] = useState("");
  const [completarBancos, setCompletarBancos] = useState(true);
  const [resultNomina, setResultNomina] = useState<Extract<NominaImportResult, { ok: true }> | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const reset = () => {
    setStep("select");
    setFormato(null);
    setLoading(false);
    setError(null);
    setPreview(null);
    setAsignaciones({});
    setResult(null);
    setNomina(null);
    setMesNomina("");
    setCompletarBancos(true);
    setResultNomina(null);
    fileObjRef.current = null;
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    fileObjRef.current = f;
    setLoading(true);
    setError(null);
    try {
      // Primero la nómina porque es el formato más específico (pide una hoja con
      // las columnas Empleado e Importe); la planilla no puede confundirse con él.
      const fdNomina = new FormData();
      fdNomina.set("file", f);
      const resNomina = await previewImportNominaAction(fdNomina);
      if (resNomina.ok) {
        setFormato("nomina");
        setNomina(resNomina);
        setMesNomina(resNomina.mesSugerido ? resNomina.mesSugerido.slice(0, 7) : "");
        setAsignaciones(
          Object.fromEntries(resNomina.personas.map((p) => [p.etiqueta, p.choferId ?? ""])),
        );
        setStep("preview");
        return;
      }

      const fdPlanilla = new FormData();
      fdPlanilla.set("file", f);
      const resPlanilla = await previewImportSueldosAction(fdPlanilla);
      if (resPlanilla.ok) {
        setFormato("planilla");
        setPreview(resPlanilla);
        setAsignaciones(
          Object.fromEntries(resPlanilla.matches.map((m) => [m.nombreExcel, m.choferId ?? ""])),
        );
        setStep("preview");
        return;
      }

      setError(
        "No se reconoció el Excel. Tiene que ser la nómina del mes (una hoja con las columnas " +
          "Empleado e Importe) o la planilla de administración y taller (bloques por mes con " +
          "sueldo, comisión, combustible, plus YPF y sábados).",
      );
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
      fd.set("asignaciones", JSON.stringify(asignaciones));

      if (formato === "nomina") {
        fd.set("mes", mesNomina ? `${mesNomina}-01` : "");
        fd.set("completarBancos", completarBancos ? "1" : "0");
        const res = await confirmImportNominaAction(fd);
        if (!res.ok) {
          setError(res.error ?? "Error al importar.");
          return;
        }
        setResultNomina(res);
      } else {
        const res = await confirmImportSueldosAction(fd);
        if (!res.ok) {
          setError(res.error ?? "Error al importar.");
          return;
        }
        setResult(res);
      }
      setStep("done");
      onDone();
    } catch (err) {
      console.error(err);
      setError("No se pudo completar la importación.");
    } finally {
      setLoading(false);
    }
  };

  const sinAsignar = preview
    ? preview.matches.filter((m) => !asignaciones[m.nombreExcel]).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary" />
            Importar Excel de sueldos
          </DialogTitle>
          <DialogDescription>
            {formato === "nomina"
              ? "Nómina del mes: lo que se le transfirió a cada persona y por qué banco. Volver a importar el mismo mes lo reemplaza."
              : formato === "planilla"
                ? "Planilla de administración y taller. Re-importar el mismo mes pisa los valores con los del archivo."
                : "Sirven los dos Excel: la nómina del mes (Empleado / Importe, con las hojas por banco) y la planilla de administración y taller. Se reconoce solo cuál es."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === "select" && (
          <form onSubmit={handlePreview} className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              required
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
                Analizar
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "preview" && formato === "nomina" && nomina && (
          <div className="space-y-4">
            <ImportNominaPreview
              preview={nomina}
              mes={mesNomina}
              onMesChange={setMesNomina}
              asignaciones={asignaciones}
              onAsignacionesChange={setAsignaciones}
              completarBancos={completarBancos}
              onCompletarBancosChange={setCompletarBancos}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={loading || !mesNomina}>
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                {mesNomina ? "Cargar la nómina" : "Elegí el mes"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && formato === "planilla" && preview && (
          <div className="space-y-4">
            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                {preview.warnings.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Meses detectados ({preview.bloques.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {preview.bloques.map((b) => (
                  <span
                    key={b.mes}
                    className="rounded-md bg-muted px-2 py-1 text-xs text-foreground"
                    title={`Facturación: ${money(b.facturacion)} · ${b.filas} empleados`}
                  >
                    {mesLabel(b.mes)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Empleados del Excel → legajo
              </h4>
              <div className="rounded-md border border-border divide-y divide-border">
                {preview.matches.map((m) => {
                  const val = asignaciones[m.nombreExcel] ?? "";
                  return (
                    // En celular el nombre del Excel va en su propio renglón y
                    // abajo el legajo elegido: los tres en fila no entran en 375px.
                    <div key={m.nombreExcel} className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2">
                      <span className="w-full sm:w-28 shrink-0 font-mono text-xs font-medium text-foreground">
                        {m.nombreExcel}
                      </span>
                      <select
                        value={val}
                        onChange={(e) =>
                          setAsignaciones((prev) => ({ ...prev, [m.nombreExcel]: e.target.value }))
                        }
                        className="h-9 sm:h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">No cargar</option>
                        {preview.roster.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} · {ROL_LABEL[r.rol] ?? r.rol}
                          </option>
                        ))}
                      </select>
                      {m.auto ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          auto
                        </span>
                      ) : m.sugeridoId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAsignaciones((prev) => ({ ...prev, [m.nombreExcel]: m.sugeridoId! }))
                          }
                          className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                          title="Hay un chofer con ese nombre. Clic para usarlo."
                        >
                          ¿chofer?
                        </button>
                      ) : (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                          sin match
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {sinAsignar > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {sinAsignar} nombre{sinAsignar !== 1 ? "s" : ""} sin asignar: sus filas no se
                  cargan (se pueden re-importar después).
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={14} className="mr-1.5" />}
                Importar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && resultNomina && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Nómina de {mesLabel(resultNomina.mes)} cargada</p>
                <p className="mt-0.5 text-xs">
                  {resultNomina.personas} personas · {money(resultNomina.total)}
                  {resultNomina.embargos > 0 && <> · {resultNomina.embargos} embargos</>}
                  {resultNomina.bancosAgregados > 0 && (
                    <> · se completó el banco en {resultNomina.bancosAgregados} legajos</>
                  )}
                  .
                </p>
              </div>
            </div>
            {resultNomina.omitidos.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Sin cargar, por no tener legajo:</p>
                <ul className="mt-1 space-y-0.5">
                  {resultNomina.omitidos.map((o) => (
                    <li key={o.etiqueta}>
                      {o.etiqueta} — {money(o.importe)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {resultNomina.bancosSinConfirmar.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Estos legajos tienen un banco que este Excel no menciona. Se dejaron como estaban:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {resultNomina.bancosSinConfirmar.map((b, i) => (
                    <li key={`${b.nombre}-${i}`}>
                      {b.nombre} — {b.banco}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => close(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Importación completada</p>
                <p className="mt-0.5 text-xs">
                  {result.meses} mes{result.meses !== 1 ? "es" : ""} · {result.aumentos} sueldos
                  base · {result.variables} filas de variables.
                  {result.omitidos.length > 0 && (
                    <> Sin cargar: {result.omitidos.join(", ")}.</>
                  )}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
