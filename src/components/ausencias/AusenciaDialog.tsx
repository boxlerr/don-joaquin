"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import {
  crearAusenciaAction,
  editarAusenciaAction,
  getViajesChoferEnRangoAction,
  getDiasPedidosAnioAction,
} from "@/app/(dashboard)/choferes/[slug]/actions";
import type { Ausencia, ViajeEnRango } from "@/app/(dashboard)/choferes/[slug]/types";
import { notaVisible } from "@/app/(dashboard)/choferes/vacaciones/derivar";
import { formatFecha } from "@/lib/utils";
import {
  SIN_MOTIVO,
  VENTANA_DISPONIBILIDAD_DIAS,
  esSinMotivo,
  fechaProsa,
} from "@/lib/ausencias-texto";

/**
 * Registrar una ausencia — el mismo diálogo en el tablero y en el legajo.
 *
 * Eran dos pantallas distintas para la misma carga: el alta rápida del tablero
 * ("Día pedido") y "Nueva ausencia / permiso" del legajo. Cada una pedía los
 * campos en otro orden, con otras palabras, y cada una tenía la mitad de lo
 * bueno de la otra — el tablero traía los motivos de un toque y el contador del
 * año, el legajo avisaba si la persona ya tenía viajes esos días. Ahora es un
 * solo formulario: cambia de quién es la ausencia (fija en el legajo, elegida en
 * el tablero) y las marcas de vacaciones, que sólo tienen sentido en el legajo.
 *
 * Pedidos de Bárbara del 02/09/2026 que entraron acá:
 *  · "además del motivo, un detalle para escribir… le puse trámite, pero me
 *    hubiera gustado aclarar que el tipo se casa" → el campo Detalle.
 *  · "no quiero que se lo agregue como vacaciones, le doy el día porque le doy
 *    el día" → el motivo "Sin motivo", que no descuenta nada.
 */

/** Los motivos que ella nombró. Son atajos para el campo, no una lista cerrada. */
const MOTIVOS = ["Turno médico", "Trámite", "Dentista", "Carnet de conducir", "Estudios"];

/** Hoy en local, no en UTC: `toISOString()` a la tarde ya devuelve mañana. */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Días de calendario del período, inclusivo: del 30/07 al 02/08 son 4. */
function diasPeriodo(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta || desde}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + dias)).toISOString().slice(0, 10);
}

export type ChoferOpcion = { id: string; nombre: string; apellido: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  /** Legajo: la persona ya está definida y no se elige. */
  choferFijoId?: string;
  /** Tablero: se elige de esta lista. Vacía = todavía cargando. */
  choferes?: ChoferOpcion[];
  /** Ausencia que se está editando (sólo desde el legajo). */
  ausencia?: Ausencia | null;
  /** Arranca marcada como vacaciones (solapa Vacaciones del legajo). */
  defaultVacaciones?: boolean;
  /**
   * `completo` (legajo): deja marcar vacaciones y fecha estimada.
   * `dia-pedido` (tablero): el alta rápida, que nunca descuenta vacaciones.
   */
  variante?: "completo" | "dia-pedido";
}

export default function AusenciaDialog({
  open,
  onOpenChange,
  onSuccess,
  choferFijoId,
  choferes,
  ausencia,
  defaultVacaciones,
  variante = "completo",
}: Props) {
  const esEdicion = !!ausencia;
  const eligePersona = !choferFijoId;
  const conVacaciones = variante === "completo";

  const [seleccionado, setSeleccionado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const [desde, setDesde] = useState(hoyISO);
  const [hasta, setHasta] = useState(hoyISO);
  const [esVacaciones, setEsVacaciones] = useState(defaultVacaciones ?? false);
  const [justificada, setJustificada] = useState(true);
  const [fechaAproximada, setFechaAproximada] = useState(false);

  const [viajesRango, setViajesRango] = useState<ViajeEnRango[]>([]);
  const [loadingViajes, setLoadingViajes] = useState(false);
  const [previo, setPrevio] = useState<{ dias: number; veces: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La nota que ya tenía la ausencia, cruda. Si es una marca de proceso ("[Import
  // cronograma…]") no se le muestra a nadie, pero tampoco se puede borrar en
  // silencio al guardar: se devuelve tal cual vino.
  const notaOriginal = useRef<string | null>(null);

  const choferId = choferFijoId ?? seleccionado;
  const sinMotivo = esSinMotivo(motivo);
  const dias = diasPeriodo(desde, hasta);

  const reset = () => {
    const hoy = hoyISO();
    setSeleccionado("");
    setMotivo("");
    setNota("");
    setDesde(hoy);
    setHasta(hoy);
    setEsVacaciones(defaultVacaciones ?? false);
    setJustificada(true);
    setFechaAproximada(false);
    setViajesRango([]);
    setPrevio(null);
    setError(null);
    notaOriginal.current = null;
  };

  // Al abrir: precargar la ausencia si es edición, o dejar todo en limpio. Sin
  // esto, abrir un alta justo después de editar arrastraba las marcas de la
  // ausencia anterior al período nuevo.
  useEffect(() => {
    if (!open) return;
    if (ausencia) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al abrir (carga o reset de estado)
      setMotivo(ausencia.tipo);
      setNota(notaVisible(ausencia.observaciones) ?? "");
      notaOriginal.current = ausencia.observaciones;
      setDesde(ausencia.fecha_inicio);
      setHasta(ausencia.fecha_fin);
      setEsVacaciones(ausencia.es_vacaciones);
      setJustificada(ausencia.justificada);
      setFechaAproximada(ausencia.fecha_aproximada);
      setError(null);
    } else {
      setEsVacaciones(defaultVacaciones ?? false);
      setJustificada(true);
      setFechaAproximada(false);
      notaOriginal.current = null;
      setError(null);
    }
  }, [open, ausencia, defaultVacaciones]);

  // Los viajes que la persona ya tiene en esas fechas: el conflicto se ve antes
  // de confirmar, no después de que Logística lo descubra.
  useEffect(() => {
    if (!open || !choferId || !desde || !hasta || hasta < desde) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setViajesRango([]);
      return;
    }
    let cancelado = false;
    setLoadingViajes(true);
    getViajesChoferEnRangoAction(choferId, desde, hasta)
      .then((vs) => {
        if (cancelado) return;
        setViajesRango(vs);
        setLoadingViajes(false);
      })
      .catch(() => {
        if (!cancelado) setLoadingViajes(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, choferId, desde, hasta]);

  // "Che flaco, vos me pediste el mes pasado cuatro días": cuántos lleva en el
  // año, antes de autorizarle el siguiente. Las vacaciones tienen su propio
  // saldo, así que ahí el contador no dice nada.
  useEffect(() => {
    if (!open || !choferId || esVacaciones) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setPrevio(null);
      return;
    }
    let vigente = true;
    getDiasPedidosAnioAction(choferId, Number(desde.slice(0, 4)) || new Date().getFullYear())
      .then((r) => {
        if (vigente) setPrevio(r);
      })
      .catch(() => {
        if (vigente) setPrevio(null);
      });
    return () => {
      vigente = false;
    };
  }, [open, choferId, desde, esVacaciones]);

  const elegirMotivo = (m: string) => {
    setMotivo((actual) => (actual.trim() === m ? "" : m));
  };

  const marcarVacaciones = (v: boolean) => {
    setEsVacaciones(v);
    // El motivo de un período de vacaciones es "Vacaciones": completarlo evita
    // el paso de tipearlo, y si ya había otro texto no se pisa.
    if (v && !motivo.trim()) setMotivo("Vacaciones");
    if (v) setJustificada(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choferId) return setError("Elegí de quién es la ausencia");
    if (!motivo.trim()) return setError("Poné el motivo");
    if (!desde) return setError("Poné la fecha");
    if (hasta && hasta < desde)
      return setError("La fecha de fin no puede ser anterior al inicio");

    setLoading(true);
    setError(null);

    // Si la nota que había era una marca de proceso no se muestra en el campo, y
    // guardar con el campo vacío la borraría: se devuelve la original.
    const notaGuardada =
      nota.trim() || (notaVisible(notaOriginal.current) ? null : notaOriginal.current) || null;

    const payload = {
      tipo: motivo.trim(),
      fecha_inicio: desde,
      // Un día suelto es lo normal: sin "hasta", el fin es el mismo día.
      fecha_fin: hasta || desde,
      observaciones: notaGuardada,
      es_vacaciones: conVacaciones ? esVacaciones : false,
      // Las vacaciones siempre quedan justificadas.
      justificada: esVacaciones ? true : justificada,
      fecha_aproximada: conVacaciones ? fechaAproximada : false,
    };

    try {
      const res = esEdicion
        ? await editarAusenciaAction(ausencia!.id, choferId, payload)
        : await crearAusenciaAction(choferId, payload);

      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        reset();
        onSuccess();
      }
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const cerrar = () => {
    reset();
    onOpenChange(false);
  };

  const titulo = esEdicion
    ? "Editar ausencia"
    : variante === "dia-pedido"
      ? "Registrar un día pedido"
      : "Nueva ausencia / permiso";

  const descripcion =
    variante === "dia-pedido"
      ? "El turno médico, el trámite, el dentista. Queda anotado en el legajo y Logística lo ve como un chofer menos ese día."
      : "Queda registrado quién la autoriza para que cualquiera que tome la logística lo vea.";

  // Desde cuándo aparece en las tarjetas de disponibilidad (tablero y /viajes),
  // que miran una ventana de dos semanas. Cargar algo para dentro de un mes y no
  // verlo en ningún lado se lee como que no se guardó.
  const hoy = hoyISO();
  const apareceDesde = sumarDias(desde, -VENTANA_DISPONIBILIDAD_DIAS);
  const yaVisible = apareceDesde <= hoy;

  const nombreElegido = choferes?.find((c) => c.id === seleccionado);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg text-foreground">{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          {eligePersona && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Quién <span className="text-red-500">*</span>
              </Label>
              <Combobox
                options={(choferes ?? []).map((c) => ({
                  id: c.id,
                  label: `${c.apellido}, ${c.nombre}`,
                }))}
                value={seleccionado}
                onValueChange={(id) => {
                  setSeleccionado(id);
                  // El contador se limpia acá y no en el efecto: si no, al
                  // cambiar de persona se veía un instante el número de la anterior.
                  setPrevio(null);
                }}
                placeholder={choferes?.length ? "Buscá por apellido…" : "Cargando…"}
              />
            </div>
          )}

          {/* Cuántos días lleva pedidos en el año. Va pegado a la persona en el
              tablero y arriba de todo en el legajo: es lo que se mira antes de
              decir que sí. */}
          {previo && !esVacaciones && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {previo.dias === 0
                ? `${nombreElegido?.nombre ?? "Todavía"} no pidió ningún día en ${desde.slice(0, 4)}.`
                : `${nombreElegido ? nombreElegido.nombre + " ya" : "Ya"} pidió ${previo.dias} día${previo.dias === 1 ? "" : "s"} en ${desde.slice(0, 4)}, en ${previo.veces} ${previo.veces === 1 ? "vez" : "veces"}.`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="au-desde" className="text-sm font-medium">
                Desde <span className="text-red-500">*</span>
              </Label>
              <Input
                id="au-desde"
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  if (e.target.value && hasta < e.target.value) setHasta(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="au-hasta" className="text-sm font-medium">
                  Hasta <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {dias} día{dias === 1 ? "" : "s"}
                </span>
              </div>
              <Input
                id="au-hasta"
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Lo que más le importa del pedido: que Logística lo vea. Decir desde
              cuándo evita la duda de "lo cargué y no aparece en ningún lado". */}
          <p className="-mt-1 text-[11px] text-muted-foreground">
            {yaVisible
              ? "Logística ya lo ve en Viajes y en el tablero."
              : `Logística lo ve en Viajes y en el tablero a partir del ${fechaProsa(apareceDesde)}.`}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="au-motivo" className="text-sm font-medium">
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="au-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Turno médico, trámite del DNI…"
            />

            {/* Atajos, no una lista cerrada: el motivo se guarda como texto, así
                que siempre se puede escribir algo que no esté acá. */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => elegirMotivo(m)}
                  className={`rounded-md border px-2 py-1 text-[11px] transition-colors max-md:py-1.5 ${
                    motivo.trim() === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}

              {/* "Le doy el día porque le doy el día" (Bárbara, 02/09/2026). No es
                  lo mismo que una falta: el día está autorizado, sólo que no hubo
                  motivo que anotar. Va último y punteado, para que no se lea como
                  un motivo más de la lista. */}
              <button
                type="button"
                onClick={() => elegirMotivo(SIN_MOTIVO)}
                className={`rounded-md border px-2 py-1 text-[11px] transition-colors max-md:py-1.5 ${
                  sinMotivo
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-dashed border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {SIN_MOTIVO}
              </button>
            </div>

            {sinMotivo && (
              <p className="text-[11px] text-muted-foreground">
                Se le dio el día igual. No descuenta vacaciones y no cuenta como falta.
              </p>
            )}
          </div>

          {/* "Le puse trámite, pero me hubiera gustado aclarar que el tipo se
              casa… por ahí en un año no me acuerdo" (Bárbara, 02/09/2026). */}
          <div className="space-y-1.5">
            <Label htmlFor="au-nota" className="text-sm font-medium">
              Detalle <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="au-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Se casa, se muda, un familiar…"
            />
            <p className="text-[11px] text-muted-foreground">
              Queda en el legajo, para acordarte dentro de un año por qué se lo diste.
            </p>
          </div>

          {conVacaciones && (
            <div className="space-y-3 border-t border-border pt-3">
              <label className="flex cursor-pointer select-none items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={esVacaciones}
                  onChange={(e) => marcarVacaciones(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border accent-[#0088D1]"
                />
                {/* Un solo nodo de texto: adentro de un label flex, cada span
                    suelto se separa con el gap y quedan huecos entre palabras. */}
                <span>
                  Es período de <span className="font-medium">vacaciones</span> (descuenta del
                  saldo)
                </span>
              </label>

              {/* "Que me ponga tres semanas en febrero… si yo pongo la fecha
                  incierta, que siga incierta" (Bárbara, 29/07/2026). La cantidad
                  de días no cambia: eso es firme. */}
              <label className="flex cursor-pointer select-none items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={fechaAproximada}
                  onChange={(e) => setFechaAproximada(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border accent-[#0088D1]"
                />
                <span>
                  Todavía no está la fecha exacta
                  <span className="block text-[11px] text-muted-foreground">
                    Los días cuentan igual en el saldo. En el legajo el período queda marcado
                    con un ~, para que nadie lo tome como fecha confirmada.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Injustificada: sólo para lo que no son vacaciones, y separado del
              "sin motivo" — pedir el día y no aparecer no son lo mismo. */}
          {!esVacaciones && (
            <label
              className={`flex cursor-pointer select-none items-start gap-2 text-sm text-foreground ${
                conVacaciones ? "" : "border-t border-border pt-3"
              }`}
            >
              <input
                type="checkbox"
                checked={!justificada}
                onChange={(e) => setJustificada(!e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-[#EF4444]"
              />
              <span>
                Fue <span className="font-medium text-[#EF4444]">injustificada</span>
                <span className="block text-[11px] text-muted-foreground">
                  Marcalo sólo si faltó sin avisar. Resta puntos en el ranking.
                </span>
              </span>
            </label>
          )}

          {/* Viajes que ya tiene en esas fechas: "de nada sirve que Nico sepa que
              tiene 5 choferes menos si yo después le clavo 7 con turnos". */}
          {loadingViajes ? (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 size={13} className="animate-spin" />
              Buscando viajes en estas fechas…
            </p>
          ) : viajesRango.length > 0 ? (
            <div className="space-y-1.5 rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <AlertTriangle size={14} className="shrink-0 text-[#D97706]" />
                Ya tiene {viajesRango.length} viaje{viajesRango.length !== 1 ? "s" : ""} en estas
                fechas
              </p>
              <ul className="space-y-1">
                {viajesRango.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground"
                  >
                    <span className="font-medium text-foreground/80">
                      {formatFecha(v.fecha_viaje)}
                    </span>
                    <MapPin size={11} className="shrink-0 text-[#D97706]" />
                    <span>
                      {v.origen ? `${v.origen} → ` : ""}
                      {v.destino ?? "—"}
                    </span>
                    {v.cliente && <span>· {v.cliente}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : choferId ? (
            <p className="text-[11px] text-muted-foreground">
              Sin viajes asignados en estas fechas.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={loading}>
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Guardando…" : esEdicion ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
