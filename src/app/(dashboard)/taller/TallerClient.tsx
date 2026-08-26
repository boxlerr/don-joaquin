"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Check, Loader2, Truck, User, X } from "lucide-react";
import { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  crearUrlSubidaRoturaAction,
  getArchivosRoturaAction,
  deleteArchivoRoturaAction,
} from "../mantenimiento/actions";
import { cargarTrabajoTallerAction, type DatosTaller, type TrabajoFeed } from "./actions";
import { leerMensaje } from "./parseo";

/**
 * Cargar un trabajo del taller desde el teléfono.
 *
 * La restricción que manda sobre todo el diseño la puso Bárbara: *"que lo
 * cargue una persona que no tiene un pato en fila… cero habilidades con la
 * compu"*. Por eso la pantalla **no tiene formulario**: tiene una foto y un
 * texto, igual que el grupo de WhatsApp donde hoy reportan todo.
 *
 * Tres decisiones que se siguen de eso:
 *
 *  · **Se escribe libre y el sistema entiende.** La patente y el nombre salen
 *    del texto (ver `parseo.ts`), no de dos selectores que habría que buscar en
 *    una lista de 40 unidades con el dedo.
 *  · **Lo entendido se muestra antes de mandar.** Si el parser se equivoca, se
 *    ve. Un dato adivinado en silencio es peor que un campo vacío.
 *  · **Nada es obligatorio salvo el texto.** Si no reconoce la patente, se
 *    guarda igual y se completa después. Perder el registro por un campo que
 *    faltaba es volver al grupo de WhatsApp, que es de donde venimos.
 */

/** 56px de alto: es el mínimo con el que un dedo acierta sin apuntar. */
const BOTON = "h-14 rounded-xl text-base font-semibold";

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function TallerClient({
  datos,
  feedInicial,
  canWrite,
}: {
  datos: DatosTaller;
  feedInicial: TrabajoFeed[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const camaraRef = useRef<HTMLInputElement>(null);

  const adj = useAdjuntos({
    open: true,
    entidadId: null,
    crearUrlSubida: crearUrlSubidaRoturaAction,
    getArchivos: getArchivosRoturaAction,
    deleteArchivo: deleteArchivoRoturaAction,
    onError: setError,
  });

  const lectura = useMemo(
    () => leerMensaje(texto, datos.unidades, datos.personas),
    [texto, datos.unidades, datos.personas],
  );

  const puedeGuardar = texto.trim().length > 0 && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const archivos = await adj.subirPendientes();
      const res = await cargarTrabajoTallerAction({
        texto: texto.trim(),
        unidadId: lectura.unidad?.id ?? null,
        unidadTipo: lectura.unidad?.tipo ?? null,
        personaId: lectura.persona?.id ?? null,
        archivos,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTexto("");
      setListo(true);
      router.refresh();
      setTimeout(() => setListo(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      {canWrite && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {/* La foto va PRIMERO porque es lo primero que hacen: sacan la foto y
              después escriben. El input abre la cámara directo, sin pasar por el
              carrete. */}
          <input
            ref={camaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              adj.agregarArchivos(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => camaraRef.current?.click()}
            disabled={guardando}
            className={`flex w-full items-center justify-center gap-2.5 border-2 border-dashed border-border bg-muted/30 text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${BOTON}`}
          >
            <Camera size={22} />
            {adj.pendientes.length > 0 ? "Sacar otra foto" : "Sacar una foto"}
          </button>

          {adj.pendientes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {adj.pendientes.map((f, i) => (
                <li key={`${f.name}-${i}`} className="relative">
                  <Image
                    src={URL.createObjectURL(f)}
                    alt=""
                    width={84}
                    height={84}
                    unoptimized
                    className="size-20 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => adj.quitarPendiente(i)}
                    aria-label="Quitar la foto"
                    className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* text-base y no text-sm: por debajo de 16px, iOS hace zoom solo al
              tocar el campo y la pantalla queda corrida. */}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            disabled={guardando}
            placeholder={"¿Qué se hizo?\n\nRefuerzo en balancín\nAF-112-ON\nAlbornoz Matías"}
            className="mt-3 w-full resize-none rounded-xl border border-input bg-background p-3.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
          />

          {/* Lo que entendió. Aparece sólo cuando hay algo que confirmar: en un
              teléfono, un bloque vacío se come media pantalla. */}
          {(lectura.unidad || lectura.persona || lectura.patenteDesconocida || lectura.bajas) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lectura.unidad && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-900">
                  <Truck size={14} />
                  {lectura.unidad.patente}
                </span>
              )}
              {lectura.persona && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-900">
                  <User size={14} />
                  {lectura.persona.apellido} {lectura.persona.nombre}
                </span>
              )}
              {lectura.bajas != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm text-foreground">
                  baja n° {lectura.bajas}
                </span>
              )}
              {lectura.patenteDesconocida && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">
                  {lectura.patenteDesconocida} no está cargada — se guarda igual
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              {error}
            </p>
          )}

          {listo && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
              Guardado. Ya quedó registrado.
            </p>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={!puedeGuardar}
            className={`mt-3 flex w-full items-center justify-center gap-2 bg-[#0088D1] text-white transition-colors hover:bg-[#0277BD] disabled:opacity-40 ${BOTON}`}
          >
            {guardando ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {adj.subiendo
                  ? `Subiendo la foto ${adj.subiendo.idx + 1} de ${adj.subiendo.total}…`
                  : "Guardando…"}
              </>
            ) : (
              <>
                <Check size={20} />
                Listo
              </>
            )}
          </button>
        </div>
      )}

      {/* Lo cargado, como se ve en el grupo: foto, texto y cuándo. */}
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Lo último cargado</h2>
        {feedInicial.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay trabajos cargados. El primero que cargues aparece acá.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {feedInicial.map((t) => (
              <li key={t.id} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                {t.fotos.length > 0 && (
                  <div className="mb-2.5 flex gap-2 overflow-x-auto">
                    {t.fotos.map((f) => (
                      <Image
                        key={f}
                        src={f}
                        alt=""
                        width={200}
                        height={200}
                        unoptimized
                        className="h-28 w-auto shrink-0 rounded-lg border border-border object-cover"
                      />
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-line text-[15px] leading-snug text-foreground">
                  {t.texto}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{fechaCorta(t.fecha)}</span>
                  {t.patente && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Truck size={11} />
                        {t.patente}
                      </span>
                    </>
                  )}
                  {t.persona && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <User size={11} />
                        {t.persona}
                      </span>
                    </>
                  )}
                  {t.quien && (
                    <>
                      <span aria-hidden>·</span>
                      <span>cargó {t.quien}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
