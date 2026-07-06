"use client";

import { useEffect, useState } from "react";
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
import AdjuntosDocumentos, { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  addRoturaAction,
  updateRoturaAction,
  crearUrlSubidaRoturaAction,
  getArchivosRoturaAction,
  deleteArchivoRoturaAction,
  type RoturaRow,
  type InsumoRow,
} from "../actions";
import type { AcopladoOption, CamionOption, ChoferOption } from "../types";

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

export default function AddRoturaDialog({
  children,
  camiones,
  acoplados,
  choferes,
  insumos,
  editing,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children?: React.ReactNode;
  camiones: CamionOption[];
  acoplados: AcopladoOption[];
  choferes: ChoferOption[];
  insumos: InsumoRow[];
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
  const [tipo, setTipo] = useState("");
  const [tipoCustom, setTipoCustom] = useState("");
  const [gravedad, setGravedad] = useState<"leve" | "grave">("leve");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("1");
  const [costo, setCosto] = useState("");
  const [posicion, setPosicion] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const [marca, setMarca] = useState("");
  const [estadoUso, setEstadoUso] = useState("");
  // Marca que el costo se trajo del catálogo (para mostrar el aviso "traído del catálogo").
  const [costoDeInsumo, setCostoDeInsumo] = useState(false);

  const insumosActivos = insumos.filter((i) => i.estado === "activo");
  const hayCatalogo = insumosActivos.length > 0;

  // Selector unificado "¿Qué se rompió?": con catálogo cargado, las opciones son
  // los insumos (traen el costo) + "Otro…" (texto libre). Sin catálogo, caemos a
  // los tipos genéricos. Al editar una rotura vieja cargada con un tipo genérico
  // (sin insumo), se agrega ese tipo para que siga siendo seleccionable.
  const opcionesQue: { value: string; label: string }[] = [];
  if (hayCatalogo) {
    for (const i of insumosActivos) {
      opcionesQue.push({
        value: `insumo:${i.id}`,
        label: `${i.nombre}${i.marca ? ` · ${i.marca}` : ""}${i.precio > 0 ? ` — $${i.precio.toLocaleString("es-AR")}` : ""}`,
      });
    }
    if (!insumoId && tipo && tipo !== "otro" && VALORES_CONOCIDOS.has(tipo)) {
      const g = TIPOS_ROTURA.find((t) => t.value === tipo);
      if (g) opcionesQue.push({ value: `tipo:${tipo}`, label: g.label });
    }
  } else {
    for (const t of TIPOS_ROTURA) {
      if (t.value !== "otro") opcionesQue.push({ value: `tipo:${t.value}`, label: t.label });
    }
  }
  opcionesQue.push({ value: "otro", label: "Otro…" });

  // Valor y etiqueta del selector según el estado actual (insumo o tipo genérico).
  const queValue = insumoId ? `insumo:${insumoId}` : tipo === "otro" ? "otro" : tipo ? `tipo:${tipo}` : "";
  const queLabel =
    opcionesQue.find((o) => o.value === queValue)?.label ??
    (queValue === "otro" ? "Otro…" : "Elegí qué se rompió…");

  const adj = useAdjuntos({
    open,
    entidadId: editing?.id ?? null,
    crearUrlSubida: crearUrlSubidaRoturaAction,
    getArchivos: getArchivosRoturaAction,
    deleteArchivo: deleteArchivoRoturaAction,
    onError: setError,
  });

  const choferSel = choferes.find((c) => c.id === choferId);
  const esGoma = tipo === "goma";
  const esOtro = tipo === "otro";
  // La gravedad solo aplica a roturas que NO son gomas/llantas (esas cuentan en
  // su propio concepto del score). "Grave" pesa más que "leve" en "roturas varias".
  // Oculta hasta elegir qué se rompió, para no mostrarla en vacío.
  const mostrarGravedad = tipo !== "" && tipo !== "goma" && tipo !== "llanta";
  // El "% de uso / estado" (como lo anota la planilla real) solo tiene sentido en gomas/llantas.
  const mostrarEstadoUso = tipo === "goma" || tipo === "llanta";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
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
      setGravedad(editing.gravedad === "grave" ? "grave" : "leve");
      setFecha(editing.fecha);
      setCantidad(String(editing.cantidad ?? 1));
      setCosto(editing.costo != null ? String(editing.costo) : "");
      setPosicion(editing.posicion ?? "");
      setInsumoId(editing.insumo_id ?? "");
      setMarca(editing.marca ?? "");
      setEstadoUso(editing.estado_uso ?? "");
      setCostoDeInsumo(false);
    } else {
      setChoferId("");
      setUnidad("");
      setTipo("");
      setTipoCustom("");
      setGravedad("leve");
      setFecha(new Date().toISOString().split("T")[0]);
      setCantidad("1");
      setCosto("");
      setPosicion("");
      setInsumoId("");
      setMarca("");
      setEstadoUso("");
      setCostoDeInsumo(false);
    }
    setUnidadAuto(false);
    setError(null);
    setSuccess(null);
  }, [open, editing]);

  /**
   * Al elegir un chofer, autoseleccionar el camión que tiene asignado. El
   * usuario puede después cambiar o limpiar la unidad: es solo un atajo.
   */
  const elegirChofer = (id: string) => {
    setChoferId(id);
    const camionAsignado = id ? camiones.find((c) => c.chofer_actual_id === id) : undefined;
    if (camionAsignado) {
      setUnidad(`c:${camionAsignado.id}`);
      setUnidadAuto(true);
    } else if (unidadAuto) {
      // Se eligió "Sin asignar" (o un chofer sin unidad) y la unidad estaba
      // puesta automáticamente: la limpiamos.
      setUnidad("");
      setUnidadAuto(false);
    }
  };

  // Cambio manual de unidad: deja de considerarse "automática".
  const elegirUnidad = (v: UnidadValue) => {
    setUnidad(v);
    setUnidadAuto(false);
  };

  // Selector unificado "¿Qué se rompió?". Tres casos:
  //  · insumo del catálogo → setea categoría + marca + trae el precio (editable).
  //  · tipo genérico → setea la categoría, sin tocar el costo.
  //  · "otro" → texto libre (aparece el input).
  const elegirQueSeRompio = (v: string) => {
    if (v.startsWith("insumo:")) {
      const id = v.slice("insumo:".length);
      setInsumoId(id);
      const ins = insumos.find((i) => i.id === id);
      if (ins) {
        setTipo(ins.tipo);
        setTipoCustom("");
        if (ins.marca) setMarca(ins.marca);
        setCosto(String(ins.precio ?? 0));
        setCostoDeInsumo(true);
      }
    } else if (v === "otro") {
      setInsumoId("");
      setTipo("otro");
      setTipoCustom("");
      setCostoDeInsumo(false);
    } else if (v.startsWith("tipo:")) {
      setInsumoId("");
      setTipo(v.slice("tipo:".length));
      setTipoCustom("");
      setCostoDeInsumo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tipo) return setError("Elegí qué se rompió.");
    if (!choferId && !unidad) return setError("Elegí el chofer o la unidad (camión / acoplado).");
    if (esOtro && !tipoCustom.trim()) return setError("Escribí qué se rompió.");
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) Subir primero los adjuntos nuevos (directo al Storage con URL firmada).
      const archivos = await adj.subirPendientes();

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
        gravedad: mostrarGravedad ? gravedad : "leve",
        fecha,
        cantidad: parseInt(cantidad) || 1,
        costo: costo ? parseFloat(costo) : null,
        posicion: posicion || null,
        insumo_id: insumoId || null,
        marca: marca.trim() || null,
        estado_uso: mostrarEstadoUso ? estadoUso.trim() || null : null,
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (loading) return; setOpen(v); }}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">{editing ? "Editar rotura" : "Registrar rotura"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cualquier rotura de la unidad (goma, guardabarros, espejo, etc.). Si cargás el chofer, suma a su productividad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && <InlineFeedback variant="error" message={error} onDismiss={() => setError(null)} autoHideMs={0} />}
          {success && <InlineFeedback variant="success" message={success} onDismiss={() => setSuccess(null)} />}

          {/* Qué se rompió (unificado con el catálogo) + Marca */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="que" className="text-sm font-medium text-foreground">
                ¿Qué se rompió? <span className="text-red-400">*</span>
                {hayCatalogo && (
                  <span className="text-muted-foreground font-normal"> · del catálogo trae el costo</span>
                )}
              </Label>
              <Select value={queValue} onValueChange={(v) => elegirQueSeRompio(v ?? "")}>
                <SelectTrigger id="que" className="w-full">
                  <span className={queValue ? "" : "text-muted-foreground"}>{queLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  {opcionesQue.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {esOtro && (
                <Input
                  placeholder="Escribí qué se rompió (ej: tanque de combustible)"
                  value={tipoCustom}
                  onChange={(e) => setTipoCustom(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="marca" className="text-sm font-medium text-foreground">
                Marca <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="marca"
                placeholder="Ej: Michelin, Bazán, Work…"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
              />
            </div>
          </div>

          {mostrarGravedad && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Gravedad</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "leve", label: "Leve", hint: "Daño menor (ej: rayón)" },
                  { value: "grave", label: "Grave", hint: "Por mal uso (ej: caja volcadora)" },
                ] as const).map((g) => {
                  const activo = gravedad === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGravedad(g.value)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        activo
                          ? g.value === "grave"
                            ? "border-[#EF4444] bg-[#FEF2F2]"
                            : "border-[#0088D1] bg-[#F0F9FF]"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${activo && g.value === "grave" ? "text-[#991B1B]" : "text-foreground"}`}>
                        {g.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{g.hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Una rotura grave penaliza más que una leve en el score del chofer.
              </p>
            </div>
          )}

          {/* Chofer + Unidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Fecha + Cantidad + Costo */}
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
              <Input
                id="costo"
                type="number"
                placeholder="Opcional"
                value={costo}
                onChange={(e) => { setCosto(e.target.value); setCostoDeInsumo(false); }}
              />
            </div>
          </div>

          {costoDeInsumo && costo && (
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Costo traído del catálogo — podés ajustarlo si hace falta.
            </p>
          )}

          {/* % de uso (solo gomas) + Notas */}
          <div className={`grid gap-4 ${mostrarEstadoUso ? "sm:grid-cols-2" : "grid-cols-1"}`}>
            {mostrarEstadoUso && (
              <div className="space-y-2">
                <Label htmlFor="estado-uso" className="text-sm font-medium text-foreground">
                  % de uso / estado <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="estado-uso"
                  placeholder="Ej: 30% de uso, media, casi nueva…"
                  value={estadoUso}
                  onChange={(e) => setEstadoUso(e.target.value)}
                />
              </div>
            )}
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
          </div>

          <AdjuntosDocumentos ctrl={adj} disabled={loading} />

          <DialogFooter className="pt-4 sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="text-muted-foreground border-border hover:bg-muted/40">
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">
              {loading
                ? adj.subiendo
                  ? `Subiendo… ${adj.subiendo.pct}%`
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
