"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import InlineFeedback from "@/components/ui/InlineFeedback";
import UnidadPicker, { type UnidadValue } from "./UnidadPicker";
import {
  addRoturaAction,
  updateRoturaAction,
  crearUrlSubidaRoturaAction,
  getArchivosRoturaAction,
  deleteArchivoRoturaAction,
  type RoturaRow,
  type RoturaArchivo,
  type RoturaArchivoMeta,
} from "../actions";
import { subirArchivoConUrlFirmada } from "@/lib/client-upload";
import type { AcopladoOption, CamionOption, ChoferOption } from "../types";
import { Upload, Trash2, FileText, ImageIcon, Download, Eye, Loader2, Paperclip } from "lucide-react";

/** Catálogo de "qué se rompió". El valor se guarda en `roturas_gomas.tipo`. */
export const TIPOS_ROTURA: { value: string; label: string }[] = [
  { value: "goma", label: "Goma / cubierta" },
  { value: "llanta", label: "Llanta" },
  { value: "guardabarros", label: "Guardabarros" },
  { value: "paragolpes", label: "Paragolpes / defensa" },
  { value: "espejo", label: "Espejo" },
  { value: "optica", label: "Óptica / faro" },
  { value: "parabrisas", label: "Parabrisas / vidrio" },
  { value: "carroceria", label: "Carrocería / chapa" },
  { value: "electrico", label: "Eléctrico" },
  { value: "mecanico", label: "Mecánico" },
  { value: "otro", label: "Otro…" },
];

/** Etiqueta legible de un tipo de rotura (acepta valores custom de "Otro"). */
export function tipoRoturaLabel(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  const known = TIPOS_ROTURA.find((t) => t.value === tipo);
  if (known && known.value !== "otro") return known.label;
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

const VALORES_CONOCIDOS = new Set(TIPOS_ROTURA.map((t) => t.value));

const MAX_MB = 100;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function esImagen(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

export default function AddRoturaDialog({
  children,
  camiones,
  acoplados,
  choferes,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  camiones: CamionOption[];
  acoplados: AcopladoOption[];
  choferes: ChoferOption[];
  editing?: RoturaRow | null;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [choferId, setChoferId] = useState("");
  const [unidad, setUnidad] = useState<UnidadValue>("");
  // Marca si la unidad se puso automáticamente al elegir el chofer. Permite
  // limpiarla cuando el chofer vuelve a "Sin asignar", sin pisar una unidad que
  // el usuario haya elegido a mano.
  const [unidadAuto, setUnidadAuto] = useState(false);
  const [tipo, setTipo] = useState("goma");
  const [tipoCustom, setTipoCustom] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [posicion, setPosicion] = useState("");

  // Adjuntos: archivos nuevos pendientes de subir + los ya guardados (edición).
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [existentes, setExistentes] = useState<RoturaArchivo[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [deletingArchivoId, setDeletingArchivoId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ idx: number; total: number; pct: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const choferSel = choferes.find((c) => c.id === choferId);
  const esGoma = tipo === "goma";
  const esOtro = tipo === "otro";

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    if (editing) {
      setChoferId(editing.chofer_id ?? "");
      setUnidad(editing.camion_id ? `c:${editing.camion_id}` : editing.acoplado_id ? `a:${editing.acoplado_id}` : "");
      // Si el tipo guardado no está en el catálogo, es un "Otro" custom.
      const t = editing.tipo ?? "goma";
      if (VALORES_CONOCIDOS.has(t)) {
        setTipo(t);
        setTipoCustom("");
      } else {
        setTipo("otro");
        setTipoCustom(t);
      }
      setFecha(editing.fecha);
      setCantidad(String(editing.cantidad ?? 1));
      setCosto(editing.costo != null ? String(editing.costo) : "");
      setPosicion(editing.posicion ?? "");
      // Adjuntos ya guardados de esta rotura.
      setExistentes([]);
      setLoadingArchivos(true);
      getArchivosRoturaAction(editing.id)
        .then((a) => { if (!cancelado) setExistentes(a); })
        .finally(() => { if (!cancelado) setLoadingArchivos(false); });
    } else {
      setChoferId("");
      setUnidad("");
      setTipo("goma");
      setTipoCustom("");
      setFecha(new Date().toISOString().split("T")[0]);
      setCantidad("1");
      setCosto("");
      setPosicion("");
      setExistentes([]);
      setLoadingArchivos(false);
    }
    setUnidadAuto(false);
    setPendientes([]);
    setSubiendo(null);
    setError(null);
    setSuccess(null);
    if (fileRef.current) fileRef.current.value = "";
    return () => { cancelado = true; };
  }, [open, editing]);

  /**
   * Al elegir un chofer, autoseleccionar el camión que tiene asignado (si lo
   * hay). El usuario puede después cambiar o limpiar la unidad libremente: solo
   * es un atajo, no fuerza nada.
   */
  const elegirChofer = (id: string) => {
    setChoferId(id);
    const camionAsignado = id ? camiones.find((c) => c.chofer_actual_id === id) : undefined;
    if (camionAsignado) {
      setUnidad(`c:${camionAsignado.id}`);
      setUnidadAuto(true);
    } else if (unidadAuto) {
      // Se eligió "Sin asignar" (o un chofer sin unidad asignada) y la unidad
      // estaba puesta automáticamente: la limpiamos.
      setUnidad("");
      setUnidadAuto(false);
    }
  };

  // Cambio manual de unidad: deja de considerarse "automática".
  const elegirUnidad = (v: UnidadValue) => {
    setUnidad(v);
    setUnidadAuto(false);
  };

  const agregarArchivos = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const grande = arr.find((f) => f.size > MAX_BYTES);
    if (grande) {
      setError(`"${grande.name}" pesa ${fmtSize(grande.size)}. El máximo permitido es ${MAX_MB} MB por archivo.`);
      return;
    }
    setError(null);
    setPendientes((prev) => [...prev, ...arr]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const quitarPendiente = (idx: number) => {
    setPendientes((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDeleteExistente = async (id: string) => {
    setDeletingArchivoId(id);
    const res = await deleteArchivoRoturaAction(id);
    if (res?.error) {
      setError(res.error);
    } else {
      setExistentes((prev) => prev.filter((a) => a.id !== id));
    }
    setDeletingArchivoId(null);
  };

  /** Sube los archivos pendientes al Storage y devuelve sus metadatos. */
  const subirPendientes = async (): Promise<RoturaArchivoMeta[]> => {
    const metas: RoturaArchivoMeta[] = [];
    for (let i = 0; i < pendientes.length; i++) {
      const f = pendientes[i];
      setSubiendo({ idx: i + 1, total: pendientes.length, pct: 0 });
      const urlRes = await crearUrlSubidaRoturaAction({ filename: f.name });
      if ("error" in urlRes) throw new Error(urlRes.error);
      await subirArchivoConUrlFirmada({
        signedUrl: urlRes.signedUrl,
        file: f,
        onProgress: (pct) => setSubiendo({ idx: i + 1, total: pendientes.length, pct }),
      });
      metas.push({
        bucket: urlRes.bucket,
        path: urlRes.path,
        nombre_original: f.name,
        mime_type: f.type || "application/octet-stream",
        tamano_bytes: f.size,
      });
    }
    return metas;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!choferId && !unidad) return setError("Elegí el chofer o la unidad (camión / acoplado).");
    if (esOtro && !tipoCustom.trim()) return setError("Escribí qué se rompió.");
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) Subir primero los adjuntos nuevos (directo al Storage con URL firmada).
      const archivos = pendientes.length ? await subirPendientes() : [];
      setSubiendo(null);

      let camion_id: string | null = null;
      let acoplado_id: string | null = null;
      if (unidad.startsWith("c:")) camion_id = unidad.slice(2);
      else if (unidad.startsWith("a:")) acoplado_id = unidad.slice(2);

      const tipoFinal = esOtro ? tipoCustom.trim().toLowerCase() : tipo;

      const payload = {
        chofer_id: choferId || null,
        camion_id,
        acoplado_id,
        tipo: tipoFinal,
        fecha,
        cantidad: parseInt(cantidad) || 1,
        costo: costo ? parseFloat(costo) : null,
        posicion: posicion || null,
        archivos,
      };
      const result = editing
        ? await updateRoturaAction(editing.id, payload)
        : await addRoturaAction(payload);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(editing ? "Cambios guardados" : "Rotura registrada");
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error inesperado.";
      setError(msg);
    } finally {
      setLoading(false);
      setSubiendo(null);
    }
  };

  const tieneAdjuntos = existentes.length > 0 || pendientes.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); }}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">{editing ? "Editar rotura" : "Registrar rotura"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cualquier rotura de la unidad (goma, guardabarros, espejo, etc.). Si cargás el chofer, suma a su productividad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-sm font-medium text-foreground">
              ¿Qué se rompió? <span className="text-red-400">*</span>
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "goma")}>
              <SelectTrigger id="tipo" className="w-full">
                <span>{TIPOS_ROTURA.find((t) => t.value === tipo)?.label ?? "Goma / cubierta"}</span>
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ROTURA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {esOtro && (
              <Input
                className="mt-2"
                placeholder="Escribí qué se rompió (ej: tanque de combustible)"
                value={tipoCustom}
                onChange={(e) => setTipoCustom(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="chofer" className="text-sm font-medium text-foreground">
              Chofer <span className="text-muted-foreground font-normal">(suma a su productividad)</span>
            </Label>
            <Select value={choferId || "__none__"} onValueChange={(v) => elegirChofer(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger id="chofer" className="w-full">
                <span className={choferSel ? "" : "text-muted-foreground"}>
                  {choferSel ? `${choferSel.apellido}, ${choferSel.nombre}` : "Sin asignar"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {choferes.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    disabled={c.disabled}
                    title={c.motivo}
                  >
                    {c.disabled ? "⚠ " : ""}{c.apellido}, {c.nombre}
                    {c.disabled ? " — legajo incompleto" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidad" className="text-sm font-medium text-foreground">
              Unidad <span className="text-muted-foreground font-normal">(camión o acoplado)</span>
            </Label>
            <UnidadPicker
              id="unidad"
              mode="ambos"
              value={unidad}
              onChange={elegirUnidad}
              camiones={camiones}
              acoplados={acoplados}
              placeholder="Buscar por patente, marca o modelo…"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-sm font-medium text-foreground">Fecha</Label>
              <Input id="fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidad" className="text-sm font-medium text-foreground">Cantidad</Label>
              <Input id="cantidad" type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costo" className="text-sm font-medium text-foreground">Costo $</Label>
              <Input id="costo" type="number" placeholder="Opcional" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pos" className="text-sm font-medium text-foreground">
              {esGoma ? "Posición / notas" : "Notas / detalle"}{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="pos"
              placeholder={esGoma ? "Ej: trasera izquierda" : "Ej: golpe de costado, factura del taller, etc."}
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
            />
          </div>

          {/* ── Documentos adjuntos ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Paperclip size={14} className="text-muted-foreground" />
              Documentos{" "}
              <span className="text-muted-foreground font-normal">(factura, foto del daño, etc. — opcional)</span>
            </Label>

            <input
              ref={fileRef}
              type="file"
              multiple
              id="rotura-file-input"
              className="hidden"
              disabled={loading}
              onChange={(e) => agregarArchivos(e.target.files)}
            />

            {/* Adjuntos ya guardados (solo en edición) */}
            {loadingArchivos ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 size={13} className="animate-spin" /> Cargando adjuntos…
              </div>
            ) : (
              existentes.length > 0 && (
                <ul className="space-y-1.5">
                  {existentes.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-[8px] bg-muted/30">
                      {esImagen(a.mime_type) ? (
                        <ImageIcon size={15} className="text-[#0088D1] shrink-0" />
                      ) : (
                        <FileText size={15} className="text-[#0088D1] shrink-0" />
                      )}
                      <span className="text-sm text-foreground truncate flex-1 min-w-0">{a.nombre_original}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{fmtSize(a.tamano_bytes)}</span>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
                        title="Ver"
                      >
                        <Eye size={14} />
                      </a>
                      <a
                        href={a.url}
                        download={a.nombre_original}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#0088D1]/10 transition-colors"
                        title="Descargar"
                      >
                        <Download size={14} />
                      </a>
                      {deletingArchivoId === a.id ? (
                        <Loader2 size={14} className="animate-spin text-red-400 shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteExistente(a.id)}
                          disabled={loading}
                          className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )
            )}

            {/* Archivos nuevos pendientes de subir */}
            {pendientes.length > 0 && (
              <ul className="space-y-1.5">
                {pendientes.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#0088D1]/40 rounded-[8px] bg-[#F0F9FF] dark:bg-[#0088D1]/10">
                    {esImagen(f.type) ? (
                      <ImageIcon size={15} className="text-[#0088D1] shrink-0" />
                    ) : (
                      <FileText size={15} className="text-[#0088D1] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-foreground truncate block">{f.name}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtSize(f.size)} · nuevo</span>
                    </div>
                    {!loading && (
                      <button
                        type="button"
                        onClick={() => quitarPendiente(i)}
                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Quitar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Zona para agregar archivos */}
            {!loading && (
              <label
                htmlFor="rotura-file-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  agregarArchivos(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-4 border border-dashed rounded-[8px] cursor-pointer transition-colors ${
                  dragOver
                    ? "border-[#0088D1] bg-[#F0F9FF]"
                    : "border-[#CBD5E1] hover:border-[#0088D1] hover:bg-[#F0F9FF] dark:hover:bg-[#0088D1]/5"
                }`}
              >
                <Upload size={17} className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">
                  Arrastrá archivos o <span className="text-[#0088D1] font-medium">elegilos</span>
                  {tieneAdjuntos ? " (podés sumar más)" : ""}
                </span>
                <span className="text-[11px] text-muted-foreground/60">Cualquier formato — hasta {MAX_MB} MB c/u</span>
              </label>
            )}

            {/* Progreso de subida */}
            {subiendo && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Subiendo {subiendo.idx} de {subiendo.total}…
                  </span>
                  <span className="font-mono">{subiendo.pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-[#0088D1] transition-all duration-200 rounded-full"
                    style={{ width: `${subiendo.pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70">No cierres esta ventana hasta que termine.</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">
              {loading
                ? subiendo
                  ? `Subiendo… ${subiendo.pct}%`
                  : "Guardando..."
                : editing
                ? "Guardar cambios"
                : "Registrar rotura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
