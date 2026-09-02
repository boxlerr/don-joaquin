"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarPlus, Check, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  previewCalendarioAction,
  confirmarCalendarioAction,
} from "../import-calendario/actions";
import type { EstadoFila, FilaPreview, PreviewCalendario, ResultadoImport } from "../import-calendario/tipos";

/**
 * Subir el calendario del estudio contable y que las fechas queden agendadas.
 *
 * Tres pasos, los mismos que el importador del DM de YPF: se elige el archivo,
 * se MUESTRA lo que se entendió —con todo editable— y recién ahí se escribe. El
 * paso del medio no es decorativo: es lo que evita que un renglón mal leído se
 * transforme en un aviso que le llega a nueve personas con la fecha equivocada.
 *
 * Lo que el PDF no trae (el organismo y el período) se propone y se corrige acá,
 * en vez de dejarlo vacío y que alguien lo complete fila por fila después.
 */

type Paso = "elegir" | "revisar" | "listo";

const COLUMNAS_AVISO = [
  { id: "impuestos", label: "Impuestos — le llega a todo el equipo" },
  { id: "impuestos_personales", label: "Impuestos personales — reservado" },
];

const ETIQUETA_ESTADO: Record<EstadoFila, { label: string; tone: "success" | "warning" | "neutral" }> = {
  nuevo: { label: "Se agenda", tone: "success" },
  mueve_fecha: { label: "Cambia de fecha", tone: "warning" },
  ya_cargado: { label: "Ya estaba", tone: "neutral" },
};

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type FilaEditable = FilaPreview & { aplicar: boolean };

export default function ImportCalendarioModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [paso, setPaso] = useState<Paso>("elegir");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewCalendario, { ok: true }> | null>(null);
  const [filas, setFilas] = useState<FilaEditable[]>([]);
  const [periodo, setPeriodo] = useState("");
  const [altaNombre, setAltaNombre] = useState("");
  const [altaCuit, setAltaCuit] = useState("");
  const [altaColumna, setAltaColumna] = useState("impuestos_personales");
  const [resultado, setResultado] = useState<Extract<ResultadoImport, { ok: true }> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const archivoRef = useRef<File | null>(null);

  const analizar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = inputRef.current?.files?.[0];
    if (!f) return;
    archivoRef.current = f;
    setCargando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await previewCalendarioAction(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo leer el PDF.");
        return;
      }
      setPreview(res);
      // Lo que ya está cargado igual arranca destildado: no hay nada que hacerle.
      setFilas(res.filas.map((f) => ({ ...f, aplicar: f.estado !== "ya_cargado" })));
      setPeriodo(res.periodoSugerido);
      setAltaNombre(res.entidadNueva?.razonSocial ?? "");
      setAltaCuit(res.entidadNueva?.cuit ?? "");
      setPaso("revisar");
    } catch (err) {
      console.error(err);
      setError("No se pudo analizar el PDF.");
    } finally {
      setCargando(false);
    }
  };

  const parchear = (idx: number, patch: Partial<FilaEditable>) =>
    setFilas((prev) => prev.map((f) => (f.idx === idx ? { ...f, ...patch } : f)));

  const aAplicar = useMemo(() => filas.filter((f) => f.aplicar), [filas]);
  const nuevos = useMemo(() => aAplicar.filter((f) => f.estado === "nuevo").length, [aAplicar]);
  const movidos = useMemo(() => aAplicar.filter((f) => f.estado === "mueve_fecha").length, [aAplicar]);

  const entidadLista = Boolean(
    preview?.entidad || (altaNombre.trim() && /^\d{2}-\d{8}-\d$/.test(altaCuit.trim())),
  );

  const confirmar = async () => {
    if (!archivoRef.current) return;
    setCargando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", archivoRef.current);
      fd.set("periodo", periodo);
      if (preview?.entidad) {
        fd.set("entidadCodigo", preview.entidad.codigo);
      } else {
        fd.set("entidadNombre", altaNombre.trim());
        fd.set("entidadCuit", altaCuit.trim());
        fd.set("entidadColumna", altaColumna);
      }
      fd.set(
        "filas",
        JSON.stringify(
          filas.map((f) => ({
            nombre: f.nombre,
            fechaVencimiento: f.fechaVencimiento,
            organismo: f.organismo,
            aplicar: f.aplicar,
          })),
        ),
      );
      const res = await confirmarCalendarioAction(fd);
      if (!res.ok) {
        setError(res.error ?? "No se pudo confirmar.");
        return;
      }
      setResultado(res);
      setPaso("listo");
    } finally {
      setCargando(false);
    }
  };

  const reiniciar = () => {
    setPaso("elegir");
    setError(null);
    setPreview(null);
    setFilas([]);
    setPeriodo("");
    setAltaNombre("");
    setAltaCuit("");
    setAltaColumna("impuestos_personales");
    setResultado(null);
    archivoRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reiniciar();
      }}
    >
      <DialogContent
        className={
          paso === "revisar"
            ? "sm:max-w-[900px] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col"
            : "sm:max-w-[560px]"
        }
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg sm:text-xl">
            {paso === "revisar"
              ? "Vista previa — calendario del estudio"
              : paso === "listo"
                ? "Vencimientos agendados"
                : "Subir calendario de vencimientos"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {paso === "elegir" && (
              <>
                Subí el PDF que manda el estudio contable. Leemos el contribuyente, el CUIT y
                cada renglón de <strong>impuesto + vencimiento</strong>; antes de guardar nada
                vas a poder revisarlo y corregirlo.
              </>
            )}
            {paso === "revisar" && preview && (
              <>
                {preview.entidad ? (
                  <>
                    <strong>{preview.entidad.nombre}</strong> · CUIT {preview.entidad.cuit} ·{" "}
                    {preview.entidad.avisaA}
                  </>
                ) : (
                  <>Contribuyente nuevo: completá el nombre y a quién le avisa.</>
                )}
                {" · "}
                <span className="font-semibold text-[#047857]">{nuevos} a agendar</span>
                {movidos > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-[#B45309]">{movidos} cambian de fecha</span>
                  </>
                )}
              </>
            )}
            {paso === "listo" && resultado && (
              <>
                <span className="font-semibold text-[#047857]">
                  {resultado.creados} vencimiento{resultado.creados !== 1 ? "s" : ""} agendado
                  {resultado.creados !== 1 ? "s" : ""}
                </span>
                {resultado.actualizados > 0 && <> · {resultado.actualizados} con la fecha corregida</>}
                {resultado.salteados > 0 && <> · {resultado.salteados} ya estaban</>}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------------------------- */}
        {paso === "elegir" && (
          <form onSubmit={analizar} className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Cómo funciona:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>El <strong>CUIT del PDF</strong> dice de quién es el calendario y a quién le van a llegar los avisos.</li>
                <li>Cada renglón se agenda con su fecha y <strong>avisa a los 30, 15 y 5 días</strong>, y de nuevo si vence sin presentarse.</li>
                <li>Lo que ya esté cargado no se duplica: si el estudio corrigió una fecha, se actualiza.</li>
                <li>El PDF queda archivado junto a los vencimientos que salieron de él.</li>
              </ul>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E1F5FE] file:text-primary file:font-semibold hover:file:bg-[#B3E5FC]"
              required
            />
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
            )}
            <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={cargando}>
                {cargando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {cargando ? "Leyendo..." : "Leer calendario"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ---------------------------------------------------------------- */}
        {paso === "revisar" && preview && (
          <div className="flex flex-col flex-1 min-h-0 gap-3 py-2">
            {preview.advertencias.length > 0 && (
              <div className="rounded-md border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] text-xs px-3 py-2 flex items-start gap-2 shrink-0">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {preview.advertencias.map((a, i) => (
                    <div key={i}>{a}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Alta del contribuyente cuando el CUIT no está dado de alta todavía */}
            {!preview.entidad && (
              <div className="rounded-md border border-border bg-muted/30 p-3 grid gap-3 sm:grid-cols-3 shrink-0">
                <div className="space-y-1">
                  <Label htmlFor="imp-alta-nombre" className="text-xs font-medium">Contribuyente</Label>
                  <Input
                    id="imp-alta-nombre"
                    value={altaNombre}
                    onChange={(e) => setAltaNombre(e.target.value)}
                    placeholder="Ej: Joaquín Nicolás"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-alta-cuit" className="text-xs font-medium">CUIT</Label>
                  <Input
                    id="imp-alta-cuit"
                    value={altaCuit}
                    onChange={(e) => setAltaCuit(e.target.value)}
                    placeholder="20-12345678-9"
                    aria-invalid={altaCuit.trim() !== "" && !/^\d{2}-\d{8}-\d$/.test(altaCuit.trim())}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">¿A quién le avisa?</Label>
                  <Combobox
                    options={COLUMNAS_AVISO}
                    value={altaColumna}
                    onValueChange={setAltaColumna}
                    aria-label="A quién le avisa"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3 shrink-0">
              <div className="space-y-1">
                <Label htmlFor="imp-periodo-lote" className="text-xs font-medium">
                  Período que se declara
                </Label>
                <Input
                  id="imp-periodo-lote"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="2026-08"
                  className="w-36"
                />
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                El PDF no lo trae: se propone el mes anterior al vencimiento y va igual en todas las filas.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 py-2 pl-3 text-left" />
                    <th className="py-2 text-left">Impuesto</th>
                    <th className="py-2 text-left">Organismo</th>
                    <th className="py-2 text-left">Vence</th>
                    <th className="py-2 pr-3 text-left">Qué va a pasar</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.idx} className={`border-t border-border ${f.aplicar ? "" : "opacity-50"}`}>
                      <td className="py-1.5 pl-3">
                        <input
                          type="checkbox"
                          checked={f.aplicar}
                          onChange={(e) => parchear(f.idx, { aplicar: e.target.checked })}
                          aria-label={`Importar ${f.nombre}`}
                          className="size-4 accent-[#0088D1]"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={f.nombre}
                          onChange={(e) => parchear(f.idx, { nombre: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={f.organismo}
                          onChange={(e) => parchear(f.idx, { organismo: e.target.value })}
                          placeholder="—"
                          className="h-8 w-36"
                        />
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <Input
                          type="date"
                          value={f.fechaVencimiento}
                          onChange={(e) => parchear(f.idx, { fechaVencimiento: e.target.value })}
                          className="h-8 w-40"
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge {...ETIQUETA_ESTADO[f.estado]} />
                          {f.estado === "mueve_fecha" && f.existente && (
                            <span className="text-[11px] text-muted-foreground">
                              estaba el {fmt(f.existente.fechaVencimiento)}
                            </span>
                          )}
                          {f.estado === "ya_cargado" && f.existente?.presentado && (
                            <span className="text-[11px] text-muted-foreground">ya presentado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg shrink-0">
                {error}
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={reiniciar}>
                Elegir otro archivo
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={confirmar}
                disabled={cargando || aAplicar.length === 0 || !entidadLista}
              >
                {cargando ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
                {cargando ? "Agendando..." : `Agendar ${aAplicar.length}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {paso === "listo" && resultado && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] text-sm px-3 py-3 flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Quedaron agendados en el calendario.</p>
                <p className="text-xs">
                  Los avisos salen solos a los 30, 15 y 5 días, y otra vez si el vencimiento pasa
                  sin marcarse como presentado.
                </p>
                {resultado.pdfArchivado && (
                  <p className="text-xs flex items-center gap-1">
                    <FileText size={12} /> El PDF quedó adjunto a cada vencimiento.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="pt-3 border-t border-[#F1F5F9] gap-2">
              <Button type="button" variant="outline" onClick={reiniciar}>
                Subir otro
              </Button>
              <Button type="button" variant="brand" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
