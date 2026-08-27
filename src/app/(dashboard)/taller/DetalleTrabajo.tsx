"use client";

import { useState } from "react";
import { useScrollTactil } from "@/hooks/useScrollTactil";
import Link from "next/link";
import { Check, ExternalLink, Loader2, PencilLine, Truck, User, Wrench, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FotosRotura from "../mantenimiento/components/FotosRotura";
import HistorialRotura from "../mantenimiento/components/HistorialRotura";
import { editarTrabajoTallerAction, type TrabajoFeed } from "./actions";

/**
 * El detalle de un trabajo cargado.
 *
 * En la lista sólo entran dos renglones y la foto en miniatura; acá se ve la
 * foto entera y el mensaje completo, que es lo que hace falta para saber qué se
 * hizo. Y dice **dónde quedó guardado**: un registro que no se sabe dónde vive
 * es un registro en el que no se confía.
 *
 * Desde el 27/08 también se puede **corregir**: el mensaje, y las fotos que se
 * suman o se sacan. La carga se hace desde el teléfono y muchas veces con la
 * unidad todavía arriba del elevador, así que un renglón mal escrito tiene que
 * poder arreglarse — antes la única salida era cargar el trabajo de nuevo, y
 * dos trabajos donde hubo uno rompen el costo por chofer.
 *
 * Lo que no cambia es que la corrección **se note**: lo que decía antes queda
 * guardado y se muestra acá mismo (ver `HistorialRotura`).
 */

/** "24/08/2026 a las 16:29" — la hora importa: es lo que permite reconocer el mensaje. */
function cuando(fecha: string, cargadoEn: string | null): string {
  const [y, m, d] = fecha.slice(0, 10).split("-");
  const base = `${d}/${m}/${y}`;
  if (!cargadoEn) return base;
  const dt = new Date(cargadoEn);
  if (Number.isNaN(dt.getTime())) return base;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${base} a las ${hh}:${mm}`;
}

/**
 * Qué mostrar cuando la fila no trae texto.
 *
 * Las roturas cargadas desde Mantenimiento antes de que existiera esta pantalla
 * no tienen observaciones: en la lista se veían como una tarjeta vacía con sólo
 * una fecha. Se arma una frase con lo que sí tienen.
 */
export function descripcionDe(t: TrabajoFeed): string {
  if (t.texto.trim()) return t.texto;
  const partes = [
    t.tipo ? t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1) : null,
    t.marca,
    t.posicion ? `posición ${t.posicion}` : null,
    t.cantidad && t.cantidad > 1 ? `${t.cantidad} unidades` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin detalle cargado";
}

export default function DetalleTrabajo({
  trabajo,
  canWrite = false,
  onCerrar,
  onCambio,
}: {
  trabajo: TrabajoFeed | null;
  canWrite?: boolean;
  onCerrar: () => void;
  /** Avisa que el trabajo cambió, para que la lista de atrás se ponga al día. */
  onCambio?: () => void;
}) {
  return (
    <Sheet open={trabajo !== null} onOpenChange={(v) => !v && onCerrar()}>
      <SheetContent side="bottom" className="overflow-hidden p-0 data-[side=bottom]:max-h-[85svh]">
        {/* `key` por trabajo: al pasar de uno a otro el cuerpo se rearma de
            cero. Sin eso, quedarse en modo edición con el texto del anterior es
            la forma más rápida de pisar el registro equivocado. */}
        {trabajo && (
          <CuerpoTrabajo
            key={trabajo.id}
            trabajo={trabajo}
            canWrite={canWrite}
            onCambio={onCambio}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CuerpoTrabajo({
  trabajo,
  canWrite,
  onCambio,
}: {
  trabajo: TrabajoFeed;
  canWrite: boolean;
  onCambio?: () => void;
}) {
  // Mismo problema que el selector: adentro del panel, el dedo no movía nada.
  const [cuerpo, setCuerpo] = useState<HTMLDivElement | null>(null);
  useScrollTactil(cuerpo);

  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El texto tal como quedó después de corregirlo: la lista de atrás todavía
  // tiene el viejo y recargarla lleva un momento.
  const [textoLocal, setTextoLocal] = useState<string | null>(null);
  // Sube con cada cambio para que el historial vuelva a preguntar.
  const [cambios, setCambios] = useState(0);

  const textoActual = textoLocal ?? trabajo.texto;
  const mostrado = textoLocal ?? descripcionDe(trabajo);

  const empezarAEditar = () => {
    setTexto(textoActual);
    setError(null);
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await editarTrabajoTallerAction({ id: trabajo.id, texto });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTextoLocal(texto.trim());
      setEditando(false);
      setCambios((n) => n + 1);
      onCambio?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la corrección.");
    } finally {
      setGuardando(false);
    }
  };

  const avisarCambioDeFotos = () => {
    setCambios((n) => n + 1);
    onCambio?.();
  };

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
        <SheetTitle className="text-base">{cuando(trabajo.fecha, trabajo.cargadoEn)}</SheetTitle>
      </SheetHeader>

      <div ref={setCuerpo} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-4">
        <FotosRotura roturaId={trabajo.id} canWrite={canWrite} onCambio={avisarCambioDeFotos} />

        {editando ? (
          <div>
            {/* text-base y no text-sm: por debajo de 16px iOS hace zoom solo
                al tocar el campo y la pantalla queda corrida. */}
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              disabled={guardando}
              autoFocus
              className="w-full resize-none rounded-xl border border-input bg-background p-3.5 text-base leading-relaxed text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">
              Lo que decía antes queda guardado y se ve acá abajo.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !texto.trim()}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0088D1] text-base font-semibold text-white transition-colors hover:bg-[#0277BD] disabled:opacity-40"
              >
                {guardando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={guardando}
                className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X size={18} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 whitespace-pre-line text-base leading-relaxed text-foreground">
              {mostrado}
            </p>
            {canWrite && (
              <button
                type="button"
                onClick={empezarAEditar}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <PencilLine size={13} />
                Corregir
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {trabajo.patente && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground">
              <Truck size={14} />
              {trabajo.patente}
            </span>
          )}
          {trabajo.persona && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground">
              <User size={14} />
              {trabajo.persona}
            </span>
          )}
        </div>

        {trabajo.quien && (
          <p className="text-sm text-muted-foreground">Lo cargó {trabajo.quien}.</p>
        )}

        <HistorialRotura roturaId={trabajo.id} refrescar={cambios} />

        {/* Dónde quedó. Es la pregunta que se hace cualquiera la primera
            vez que carga algo en un sistema nuevo. */}
        <div className="rounded-xl border border-border bg-muted/30 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wrench size={14} className="text-muted-foreground" />
            Dónde quedó guardado
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            En Mantenimiento, junto con el resto de las roturas y reparaciones. Desde ahí se le
            puede poner el costo y el repuesto que se usó.
          </p>
          {/* Al trabajo exacto, ya desplegado: mandar a la pantalla y
              que la persona lo busque entre 200 filas es no mandarla. */}
          <Link
            href={`/mantenimiento?tab=roturas&rotura=${trabajo.id}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Abrir Mantenimiento
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </>
  );
}
