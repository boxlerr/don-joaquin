"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";
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
  previewImportarPlanillaAction,
  aplicarImportarPlanillaAction,
  type ImportPreview,
} from "./actions";

// Importa la planilla de Bárbara (VACACIONES 2.xlsx) con vista previa: se
// muestran SOLO las diferencias (períodos que faltan y saldos distintos) y se
// aplica lo que quede tildado. Los nombres sin match nunca se importan solos.

function fmt(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function ImportarPlanillaDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [periodosSel, setPeriodosSel] = useState<Set<number>>(new Set());
  const [saldosSel, setSaldosSel] = useState<Set<number>>(new Set());

  const reset = () => {
    setPreview(null);
    setError(null);
    setNombreArchivo(null);
    setPeriodosSel(new Set());
    setSaldosSel(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  const elegirArchivo = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setPreview(null);
    setCargando(true);
    setNombreArchivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      let binario = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binario += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const res = await previewImportarPlanillaAction(btoa(binario));
      if ("error" in res) {
        setError(res.error);
      } else {
        setPreview(res);
        // Los períodos son ALTAS y no pisan nada: vienen tildados.
        setPeriodosSel(new Set(res.periodos.map((_, i) => i)));
        // Los saldos PISAN lo que ya está cargado, así que arrancan
        // destildados. Hasta ahora venían todos marcados y un click en "Aplicar"
        // reescribía los días de la dotación entera — literalmente el escenario
        // que teme Bárbara ("cuando me manden todos los choferes juntos").
        setSaldosSel(new Set());
      }
    } catch {
      setError("No se pudo procesar el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    if (!preview) return;
    setAplicando(true);
    const res = await aplicarImportarPlanillaAction({
      periodos: preview.periodos
        .filter((_, i) => periodosSel.has(i))
        .map((p) => ({ chofer_id: p.chofer_id, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin })),
      saldos: preview.saldos
        .filter((_, i) => saldosSel.has(i))
        .map((s) => ({ chofer_id: s.chofer_id, anio: s.anio, dias_correspondientes: s.otorgados_nuevo })),
    });
    setAplicando(false);
    const err = res?.errores?.length ? ` · ${res.errores.length} con problemas` : "";
    // Que se vea cuántos NO se tocaron: es la regla de blindaje hecha visible.
    const resp = res?.respetados ? ` ${res.respetados} no se tocaron porque los cargó una persona.` : "";
    alert(
      `Planilla importada: ${res?.periodosCreados ?? 0} período(s) y ${res?.saldosAplicados ?? 0} saldo(s)${err}.${resp}`,
    );
    onOpenChange(false);
    reset();
    onSuccess();
  };

  const toggle = (set: Set<number>, i: number, setter: (s: Set<number>) => void) => {
    const s = new Set(set);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setter(s);
  };

  const nadaSeleccionado = periodosSel.size === 0 && saldosSel.size === 0;
  const sinCambios = preview && preview.periodos.length === 0 && preview.saldos.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!aplicando) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">Importar planilla de vacaciones</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Subí el Excel de la planilla (formato VACACIONES 2.xlsx). Se muestran solo las diferencias
            con el sistema y elegís qué aplicar — nada se guarda hasta confirmar.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
        />

        {!preview && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={cargando}
            className="flex flex-col items-center justify-center gap-2 rounded-[8px] border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 px-6 py-10 text-sm text-muted-foreground"
          >
            {cargando ? (
              <>
                <Loader2 size={22} className="animate-spin text-primary" />
                Analizando {nombreArchivo}…
              </>
            ) : (
              <>
                <Upload size={22} className="text-primary" />
                <span className="font-medium text-foreground">Elegir el archivo de la planilla</span>
                <span className="text-xs">Se aceptan .xlsx (VACACIONES 2)</span>
              </>
            )}
          </button>
        )}

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
        )}

        {preview && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet size={14} className="text-primary" />
              {nombreArchivo}
              <button type="button" onClick={reset} className="ml-auto text-primary hover:underline">
                Cambiar archivo
              </button>
            </div>

            {sinCambios && (
              <div className="px-4 py-3 rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]">
                ✓ El sistema ya está al día con esta planilla: no hay períodos ni saldos para importar.
              </div>
            )}

            {preview.periodos.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">
                  Períodos que faltan en el sistema ({preview.periodos.length})
                </h3>
                <ul className="divide-y divide-border rounded-[8px] border border-border overflow-hidden">
                  {preview.periodos.map((p, i) => (
                    <li key={i} className="flex items-center gap-2.5 px-3 py-2 bg-card hover:bg-muted/20">
                      <input
                        type="checkbox"
                        checked={periodosSel.has(i)}
                        onChange={() => toggle(periodosSel, i, setPeriodosSel)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="font-medium text-foreground">{p.empleado}</span>
                      <span className="ml-auto text-muted-foreground whitespace-nowrap">
                        {fmt(p.fecha_inicio)} → {fmt(p.fecha_fin)} · {p.dias} día{p.dias !== 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.saldos.length > 0 && (
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">
                  Saldos distintos a la planilla ({preview.saldos.length})
                </h3>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Los saldos pisan lo que ya está cargado. Tildá sólo los que quieras reemplazar.
                </p>
                <ul className="divide-y divide-border rounded-[8px] border border-border overflow-hidden">
                  {preview.saldos.map((s, i) => {
                    const humano = s.origen_actual === "humano";
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-2.5 px-3 py-2 bg-card ${
                          humano ? "opacity-60" : "hover:bg-muted/20"
                        }`}
                      >
                        {humano ? (
                          <span className="w-[13px] shrink-0" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={saldosSel.has(i)}
                            onChange={() => toggle(saldosSel, i, setSaldosSel)}
                            className="accent-[var(--primary)]"
                          />
                        )}
                        <span className="font-medium text-foreground">{s.empleado}</span>
                        {humano ? (
                          <span className="text-xs text-muted-foreground">
                            Lo cargó una persona — el importador no lo pisa.
                          </span>
                        ) : (
                          <span className="ml-auto font-mono whitespace-nowrap text-xs">
                            Días del {s.anio}:{" "}
                            <span className="text-muted-foreground">{s.otorgados_actual}</span>
                            <span className="text-muted-foreground/60"> → </span>
                            <span className="font-semibold text-foreground">{s.otorgados_nuevo}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Al aplicar, se ajustan los días otorgados del año para que el saldo quede igual al de la planilla
                  (lo ya tomado no se toca).
                </p>
              </div>
            )}

            {preview.sinMatch.length > 0 && (
              <div className="px-4 py-2.5 rounded-[8px] border border-amber-200 bg-amber-50 text-xs text-amber-800">
                <span className="font-semibold">Nombres sin match (no se importan):</span>{" "}
                {preview.sinMatch.join(", ")} — si alguno es un empleado real, cargalo a mano o avisá para sumar el
                alias.
              </div>
            )}

            {preview.avisos.length > 0 && (
              <ul className="px-4 py-2.5 rounded-[8px] border border-border bg-muted/20 text-xs text-muted-foreground space-y-1">
                {preview.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={aplicando}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            className="text-muted-foreground border-border"
          >
            Cerrar
          </Button>
          {preview && !sinCambios && (
            <Button variant="brand" onClick={aplicar} disabled={aplicando || nadaSeleccionado}>
              {aplicando && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Aplicar los {periodosSel.size + saldosSel.size} marcados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
