"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Check, ChevronRight, Loader2, Truck, User, X, Sparkles } from "lucide-react";
import { useAdjuntos } from "@/components/ui/AdjuntosDocumentos";
import {
  crearUrlSubidaRoturaAction,
  getArchivosRoturaAction,
  deleteArchivoRoturaAction,
} from "../mantenimiento/actions";
import ElegirEnLista, { type OpcionLista } from "./ElegirEnLista";
import FeedTaller from "./FeedTaller";
import { cargarTrabajoTallerAction, type DatosTaller, type FeedResultado } from "./actions";
import { leerMensaje } from "./parseo";

/**
 * Cargar un trabajo del taller desde el teléfono.
 *
 * La restricción que manda sobre todo el diseño la puso Bárbara: *"que lo
 * cargue una persona que no tiene un pato en fila… cero habilidades con la
 * compu"*. De ahí salen las tres decisiones de la pantalla:
 *
 *  1. **Pasos numerados, uno abajo del otro.** No hay nada que descubrir: se ve
 *     qué falta y qué ya está sin leer ninguna instrucción.
 *  2. **El camión y el chofer se pueden TOCAR para elegir.** El texto libre los
 *     detecta solo (ver `parseo.ts`), pero eso es un atajo, no el único camino:
 *     si el parser no entiende o si prefiere no escribirlos, los botones están
 *     siempre a la vista. Una función que sólo existe si adivinás la fórmula no
 *     existe.
 *  3. **Hace falta el camión O el chofer**, y la pantalla lo dice desde el
 *     principio en vez de dejarlo fallar al guardar. No es un capricho: la
 *     tabla tiene un CHECK (`roturas_gomas_unidad_requerida`) que exige al
 *     menos uno de los dos. Se descubrió cargando los mensajes reales del
 *     grupo del 24/08: los de "27 bajas" no traen patente y la base los
 *     rechazaba. Prometer que se guarda igual y que después falle es peor que
 *     pedirlo de entrada.
 */

/** 56px: es el mínimo con el que un dedo acierta sin apuntar. */
const BOTON = "h-14 rounded-xl text-base font-semibold";

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** El número del paso, para que se lea como una lista y no como un formulario. */
function Paso({ n, titulo, nota }: { n: number; titulo: string; nota?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-xs font-bold text-foreground">
        {n}
      </span>
      <span className="text-sm font-semibold text-foreground">{titulo}</span>
      {nota && <span className="text-xs text-muted-foreground">· {nota}</span>}
    </div>
  );
}

/** Fila para elegir: muestra lo elegido o invita a tocar. Nunca se esconde. */
function FilaElegir({
  icono: Icono,
  valor,
  sub,
  vacio,
  detectado,
  onTocar,
  onQuitar,
  disabled,
}: {
  icono: typeof Truck;
  valor: string | null;
  sub?: string | null;
  vacio: string;
  detectado?: boolean;
  onTocar: () => void;
  onQuitar: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onTocar}
        disabled={disabled}
        className={`flex min-h-14 flex-1 items-center gap-3 rounded-xl border px-3.5 text-left transition-colors disabled:opacity-50 ${
          valor
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-dashed border-border bg-muted/20 hover:bg-muted/40"
        }`}
      >
        <Icono size={20} className={valor ? "shrink-0 text-emerald-700" : "shrink-0 text-muted-foreground"} />
        <span className="min-w-0 flex-1">
          {valor ? (
            <>
              <span className="block truncate text-base font-semibold text-emerald-900">{valor}</span>
              {(sub || detectado) && (
                <span className="block truncate text-xs text-emerald-800/80">
                  {detectado ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={11} />
                      lo saqué de lo que escribiste
                    </span>
                  ) : (
                    sub
                  )}
                </span>
              )}
            </>
          ) : (
            <span className="block text-base text-muted-foreground">{vacio}</span>
          )}
        </span>
        {!valor && <ChevronRight size={18} className="shrink-0 text-muted-foreground" />}
      </button>

      {valor && (
        <button
          type="button"
          onClick={onQuitar}
          disabled={disabled}
          aria-label="Quitar"
          className="flex w-14 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export default function TallerClient({
  datos,
  feedInicial,
  hoy,
  canWrite,
}: {
  datos: DatosTaller;
  feedInicial: FeedResultado;
  hoy: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const camaraRef = useRef<HTMLInputElement>(null);

  // Elección a mano. `undefined` = todavía manda lo que detectó el texto;
  // `null` = lo quitó a propósito. La diferencia importa: sin ella, quitar algo
  // que el parser detectó lo volvería a poner en la siguiente tecla.
  const [unidadManual, setUnidadManual] = useState<string | null | undefined>(undefined);
  const [personaManual, setPersonaManual] = useState<string | null | undefined>(undefined);
  const [abrirUnidad, setAbrirUnidad] = useState(false);
  const [abrirPersona, setAbrirPersona] = useState(false);
  // Sube cuando se guarda algo: es la señal para que el feed vuelva al principio.
  const [recargas, setRecargas] = useState(0);

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

  const unidadId = unidadManual !== undefined ? unidadManual : (lectura.unidad?.id ?? null);
  const personaId = personaManual !== undefined ? personaManual : (lectura.persona?.id ?? null);

  const unidad = datos.unidades.find((u) => u.id === unidadId) ?? null;
  const persona = datos.personas.find((p) => p.id === personaId) ?? null;

  const unidadDetectada = unidadManual === undefined && lectura.unidad != null;
  const personaDetectada = personaManual === undefined && lectura.persona != null;

  // Al vaciar el texto se vuelve a empezar: si no, una elección hecha para el
  // trabajo anterior se arrastraría al siguiente sin que se note.
  useEffect(() => {
    if (texto.trim() === "") {
      setUnidadManual(undefined);
      setPersonaManual(undefined);
    }
  }, [texto]);

  const opcionesUnidad: OpcionLista[] = useMemo(
    () =>
      datos.unidades.map((u) => ({
        id: u.id,
        principal: u.patente,
        secundario: u.tipo === "acoplado" ? "Acoplado" : "Camión",
      })),
    [datos.unidades],
  );

  const opcionesPersona: OpcionLista[] = useMemo(
    () =>
      datos.personas.map((p) => ({
        id: p.id,
        principal: `${p.apellido}, ${p.nombre}`.replace(/^,\s*|,\s*$/g, ""),
      })),
    [datos.personas],
  );

  // La base exige camión, acoplado o chofer: sin uno de los dos el insert
  // falla. Se valida acá para decirlo antes de que escriba todo, no después.
  const hayDestino = unidadId != null || personaId != null;
  const puedeGuardar = texto.trim().length > 0 && hayDestino && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const archivos = await adj.subirPendientes();
      const res = await cargarTrabajoTallerAction({
        texto: texto.trim(),
        unidadId,
        unidadTipo: unidad?.tipo ?? null,
        personaId,
        archivos,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setTexto("");
      setUnidadManual(undefined);
      setPersonaManual(undefined);
      setListo(true);
      setRecargas((n) => n + 1);
      router.refresh();
      setTimeout(() => setListo(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      {canWrite && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {/* ── 1. La foto ────────────────────────────────────────────────── */}
          <div>
            <Paso n={1} titulo="Sacá una foto" nota="si podés" />
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
              className={`flex w-full items-center justify-center gap-2.5 border-2 border-dashed border-border bg-muted/20 text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50 ${BOTON}`}
            >
              <Camera size={22} />
              {adj.pendientes.length > 0 ? "Sacar otra" : "Sacar una foto"}
            </button>

            {adj.pendientes.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-2">
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
          </div>

          {/* ── 2. Qué se hizo ────────────────────────────────────────────── */}
          <div>
            <Paso n={2} titulo="Escribí qué se hizo" />
            {/* text-base y no text-sm: por debajo de 16px iOS hace zoom solo al
                tocar el campo y la pantalla queda corrida. */}
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              disabled={guardando}
              placeholder={"Refuerzo en balancín\nAF-112-ON\nAlbornoz Matías"}
              className="w-full resize-none rounded-xl border border-input bg-background p-3.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">
              Escribilo como lo mandás por WhatsApp. Si ponés la patente o el nombre, los reconozco
              solo.
            </p>
          </div>

          {/* ── 3 y 4. Camión y quién ─────────────────────────────────────── */}
          <div>
            <Paso n={3} titulo="¿De qué camión o acoplado?" nota={hayDestino ? undefined : "hace falta este o el de abajo"} />
            <FilaElegir
              icono={Truck}
              valor={unidad?.patente ?? null}
              sub={unidad?.tipo === "acoplado" ? "Acoplado" : "Camión"}
              detectado={unidadDetectada}
              vacio="Tocá para elegir la unidad"
              onTocar={() => setAbrirUnidad(true)}
              onQuitar={() => setUnidadManual(null)}
              disabled={guardando}
            />
            {lectura.patenteDesconocida && !unidad && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Escribiste {lectura.patenteDesconocida} y esa patente no está cargada. Elegila de la
                lista, o dejalo así y se guarda igual.
              </p>
            )}
          </div>

          <div>
            <Paso n={4} titulo="¿De quién es?" nota={hayDestino ? undefined : "o este"} />
            <FilaElegir
              icono={User}
              valor={persona ? `${persona.apellido}, ${persona.nombre}`.replace(/^,\s*/, "") : null}
              detectado={personaDetectada}
              vacio="Tocá para elegir el chofer"
              onTocar={() => setAbrirPersona(true)}
              onQuitar={() => setPersonaManual(null)}
              disabled={guardando}
            />
          </div>

          {lectura.bajas != null && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              Anoté que es la baja n° {lectura.bajas}.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
              {error}
            </p>
          )}

          {listo && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
              <Check size={16} className="shrink-0" />
              Guardado. Ya quedó registrado abajo.
            </p>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={!puedeGuardar}
            className={`flex w-full items-center justify-center gap-2 bg-[#0088D1] text-white transition-colors hover:bg-[#0277BD] disabled:opacity-40 ${BOTON}`}
          >
            {guardando ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {adj.subiendo
                  ? `Subiendo la foto ${adj.subiendo.idx + 1} de ${adj.subiendo.total}…`
                  : "Guardando…"}
              </>
            ) : !texto.trim() ? (
              "Escribí qué se hizo"
            ) : !hayDestino ? (
              "Falta la unidad o el chofer"
            ) : (
              <>
                <Check size={20} />
                Guardar el trabajo
              </>
            )}
          </button>
        </div>
      )}

      <ElegirEnLista
        abierto={abrirUnidad}
        onCerrar={() => setAbrirUnidad(false)}
        titulo="¿De qué camión o acoplado?"
        opciones={opcionesUnidad}
        elegidoId={unidadId}
        onElegir={setUnidadManual}
        placeholder="Buscar por patente…"
        textoVacio="No sé de cuál es"
      />
      <ElegirEnLista
        abierto={abrirPersona}
        onCerrar={() => setAbrirPersona(false)}
        titulo="¿De quién es la unidad?"
        opciones={opcionesPersona}
        elegidoId={personaId}
        onElegir={setPersonaManual}
        placeholder="Buscar por apellido…"
        textoVacio="No sé de quién es"
      />

      <FeedTaller inicial={feedInicial} hoy={hoy} refrescar={recargas} />
    </div>
  );
}
