"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buscarTarifa,
  calcularLitros,
  destinosTodos,
  origenesDe,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";
import { filtrarChoferes } from "@/domain/gasoil/enlace";
import { anotarVueltaChoferAction } from "./actions";
import type { ChoferParaEnlace, VueltaAnotada } from "./tipos";

/**
 * La pantalla que abre el chofer.
 *
 * Está escrita para alguien parado al lado del camión, con una mano, con sol en
 * la pantalla y sin ganas de pelear con un teléfono. De ahí sale todo lo demás:
 *
 *  * **Una pregunta a la vez.** Los pasos aparecen de a uno y el anterior se
 *    achica a un renglón con "Cambiar". Nunca hay dos cosas para decidir juntas,
 *    y no hay que aprender a navegar: es una sola columna que crece para abajo.
 *  * **Nada de desplegables.** Tres canteras y cuatro destinos entran enteros en
 *    la pantalla como botones grandes. Un `<select>` nativo en Android es una
 *    rueda diminuta.
 *  * **El número aparece antes de confirmar.** Lo único que el chofer vino a
 *    buscar es cuántos litros puede cargar; lo ve apenas contesta las cuatro
 *    preguntas, sin tener que apretar nada primero.
 *  * **El teléfono se acuerda de quién es.** Elegirse entre 61 nombres una vez
 *    está bien; hacerlo en cada vuelta, no. Queda guardado en el teléfono y a
 *    partir de la segunda vez la pantalla abre directo en "de dónde saliste".
 *
 * La cuenta que se ve acá es de cortesía: la que vale la rehace el servidor con
 * la tarifa vigente (ver `actions.ts`). Si alguien toca el número en el
 * navegador, se guarda igual lo que corresponde.
 */

const RECUERDO = "dj_gasoil_chofer";

const n1 = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Lo que se tipeó, entendido como número. En Argentina se escribe "35,5". */
function aNumero(texto: string): number | null {
  const limpio = texto.replace(/\./g, "").replace(",", ".").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export default function CargaChoferClient({
  token,
  tarifas,
  choferes,
}: {
  token: string;
  tarifas: TarifaGasoil[];
  choferes: ChoferParaEnlace[];
}) {
  // `null` mientras no se leyó el teléfono: sin esto la primera pintada dice
  // "¿quién sos?" y un parpadeo después se contesta sola.
  const [hidratado, setHidratado] = useState(false);
  const [choferId, setChoferId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [toneladas, setToneladas] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<VueltaAnotada | null>(null);

  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // localStorage no existe en el server: se lee después de montar, una sola
    // vez, o la hidratación no coincidiría con lo que renderizó Next. Mismo
    // criterio que las búsquedas guardadas de legajos.
    /* eslint-disable react-hooks/set-state-in-effect -- lectura de la preferencia guardada al montar */
    try {
      const guardado = localStorage.getItem(RECUERDO);
      // Si esa persona ya no está en la lista (egresó, cambió de rol), el
      // recuerdo se descarta en silencio y vuelve a preguntar quién es.
      if (guardado && choferes.some((c) => c.id === guardado)) setChoferId(guardado);
    } catch {
      // Navegador con el almacenamiento bloqueado: se elige el nombre cada vez.
    }
    setHidratado(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [choferes]);

  const origenes = useMemo(() => origenesDe(tarifas), [tarifas]);
  const destinos = useMemo(() => destinosTodos(tarifas), [tarifas]);
  const chofer = choferes.find((c) => c.id === choferId) ?? null;

  const tarifa = buscarTarifa(tarifas, origenId, destinoId);
  const tn = aNumero(toneladas);
  const calculo = calcularLitros(tarifa, tn);
  const listaFiltrada = useMemo(
    () => filtrarChoferes(choferes, busqueda),
    [choferes, busqueda],
  );

  // Cuando aparece un paso nuevo, se lo trae a la vista. Sin esto, en un teléfono
  // chico la pregunta siguiente nace abajo del borde y parece que no pasó nada.
  useEffect(() => {
    if (!hidratado) return;
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [origenId, destinoId, hidratado]);

  function elegirChofer(id: string) {
    setChoferId(id);
    setEligiendo(false);
    setBusqueda("");
    try {
      localStorage.setItem(RECUERDO, id);
    } catch {
      // Sin almacenamiento igual funciona: sólo hay que elegirse de nuevo.
    }
  }

  async function anotar() {
    if (!chofer || !origenId || !destinoId || !calculo.ok) return;
    setEnviando(true);
    setError(null);
    const r = await anotarVueltaChoferAction({
      token,
      choferId: chofer.id,
      origenId,
      destinoId,
      toneladas: calculo.toneladas,
    });
    setEnviando(false);
    if (r.ok) setHecho(r.vuelta);
    else setError(r.mensaje);
  }

  function otraVuelta() {
    // Se conserva quién es: lo que cambia entre vuelta y vuelta es el tramo.
    setHecho(null);
    setOrigenId(null);
    setDestinoId(null);
    setToneladas("");
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!hidratado) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden />;
  }

  // ── Listo ──────────────────────────────────────────────────────────────────
  if (hecho) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-600" fill="none" strokeWidth="3"
            stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          {hecho.yaEstaba ? "Esta vuelta ya estaba anotada" : "Listo, quedó anotado"}
        </h2>
        <p className="mt-1 text-base text-slate-500">
          {hecho.yaEstaba
            ? "No se anotó dos veces. Estos son los litros que te corresponden."
            : "Ya lo ve la oficina. Estos son los litros que podés cargar."}
        </p>

        <div className="mt-6 rounded-2xl border-2 border-[#0088D1] bg-[#F5FBFE] px-5 py-7">
          <div className="text-sm font-semibold uppercase tracking-wide text-[#0088D1]">
            Podés cargar
          </div>
          <div className="mt-1 text-6xl font-bold leading-none text-slate-900">
            {n1(hecho.litros)}
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-500">litros</div>
        </div>

        <p className="mt-5 text-base text-slate-600">
          {hecho.cantera} → {hecho.destino} · {n1(hecho.toneladas)} toneladas
        </p>

        <button
          type="button"
          onClick={otraVuelta}
          className="mt-8 h-16 w-full rounded-2xl border-2 border-slate-300 bg-white text-lg font-bold text-slate-700 active:bg-slate-50"
        >
          Anotar otra vuelta
        </button>
      </div>
    );
  }

  // ── El formulario ──────────────────────────────────────────────────────────
  const preguntandoQuienSos = !chofer || eligiendo;

  return (
    <div className="space-y-5">
      {/* 1 · Quién sos */}
      {preguntandoQuienSos ? (
        <Paso numero={1} pregunta="¿Quién sos?">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscá tu apellido"
            autoComplete="off"
            className="h-14 w-full rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900 placeholder:text-slate-400 focus:border-[#0088D1] focus:outline-none"
          />
          <div className="mt-3 max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border-2 border-slate-200">
            {listaFiltrada.length === 0 ? (
              <p className="px-4 py-6 text-center text-base text-slate-500">
                No encontramos a nadie con eso. Probá con menos letras.
              </p>
            ) : (
              listaFiltrada.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegirChofer(c.id)}
                  className="flex w-full items-center px-4 py-4 text-left text-lg text-slate-800 active:bg-slate-100"
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
          {chofer && (
            <button
              type="button"
              onClick={() => {
                setEligiendo(false);
                setBusqueda("");
              }}
              className="mt-3 h-12 w-full rounded-xl text-base font-semibold text-slate-500 active:bg-slate-100"
            >
              Dejalo como estaba ({chofer.nombre})
            </button>
          )}
        </Paso>
      ) : (
        <Elegido
          etiqueta="Sos"
          valor={chofer.nombre}
          onCambiar={() => {
            setEligiendo(true);
            setBusqueda("");
          }}
        />
      )}

      {/* 2 · De dónde saliste */}
      {!preguntandoQuienSos &&
        (origenId ? (
          <Elegido
            etiqueta="Saliste de"
            valor={origenes.find((o) => o.id === origenId)?.nombre ?? ""}
            onCambiar={() => {
              setOrigenId(null);
              setDestinoId(null);
            }}
          />
        ) : (
          <Paso numero={2} pregunta="¿De dónde saliste?">
            <div className="grid gap-3">
              {origenes.map((o) => (
                <BotonGrande key={o.id} onClick={() => setOrigenId(o.id)}>
                  {o.nombre}
                </BotonGrande>
              ))}
            </div>
          </Paso>
        ))}

      {/* 3 · A dónde vas */}
      {origenId &&
        !preguntandoQuienSos &&
        (destinoId ? (
          <Elegido
            etiqueta="Vas a"
            valor={destinos.find((d) => d.id === destinoId)?.nombre ?? ""}
            onCambiar={() => setDestinoId(null)}
          />
        ) : (
          <Paso numero={3} pregunta="¿A dónde vas?">
            <div className="grid gap-3">
              {destinos.map((d) => {
                // Un destino sin rinde para esa cantera se muestra igual, apagado
                // y con el motivo: esconderlo dejaría al chofer buscando un lugar
                // que en su pantalla no existe, sin saber por qué.
                const hay = Boolean(buscarTarifa(tarifas, origenId, d.id));
                return (
                  <BotonGrande key={d.id} onClick={() => setDestinoId(d.id)} apagado={!hay}>
                    {d.nombre}
                    {!hay && (
                      <span className="mt-0.5 block text-sm font-normal text-slate-400">
                        Sin valor cargado — avisale a la oficina
                      </span>
                    )}
                  </BotonGrande>
                );
              })}
            </div>
          </Paso>
        ))}

      {/* 4 · Cuántas toneladas */}
      {origenId && destinoId && !preguntandoQuienSos && (
        <Paso numero={4} pregunta="¿Cuántas toneladas cargaste?">
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={toneladas}
              onChange={(e) => setToneladas(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="35"
              aria-label="Toneladas"
              className="h-20 w-full rounded-xl border-2 border-slate-300 px-4 text-center text-4xl font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:border-[#0088D1] focus:outline-none"
            />
            <span className="text-2xl font-semibold text-slate-400">tn</span>
          </div>

          {/* El número, apenas están las cuatro respuestas. Es a lo que vino. */}
          {toneladas.trim() !== "" && (
            <div className="mt-5">
              {calculo.ok ? (
                <div className="rounded-2xl border-2 border-[#0088D1] bg-[#F5FBFE] px-5 py-6 text-center">
                  <div className="text-sm font-semibold uppercase tracking-wide text-[#0088D1]">
                    Podés cargar
                  </div>
                  <div className="mt-1 text-6xl font-bold leading-none text-slate-900">
                    {n1(calculo.litros)}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-500">litros</div>
                </div>
              ) : (
                <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-4 text-base text-amber-900">
                  {calculo.mensaje}
                </p>
              )}
            </div>
          )}
        </Paso>
      )}

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-base text-red-800">
          {error}
        </p>
      )}

      {calculo.ok && !preguntandoQuienSos && (
        <button
          type="button"
          onClick={anotar}
          disabled={enviando}
          className="h-16 w-full rounded-2xl bg-[#0088D1] text-xl font-bold text-white active:bg-[#0277BD] disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Anotar la vuelta"}
        </button>
      )}

      <div ref={finRef} />
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────

function Paso({
  numero,
  pregunta,
  children,
}: {
  numero: number;
  pregunta: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 text-xl font-bold text-slate-900">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base text-white">
          {numero}
        </span>
        {pregunta}
      </h2>
      {children}
    </section>
  );
}

/** Un paso ya contestado: ocupa un renglón y se puede volver a abrir. */
function Elegido({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {etiqueta}
        </div>
        <div className="truncate text-lg font-bold text-slate-900">{valor}</div>
      </div>
      <button
        type="button"
        onClick={onCambiar}
        className="h-11 shrink-0 rounded-lg px-3 text-base font-bold text-[#0088D1] active:bg-slate-200"
      >
        Cambiar
      </button>
    </div>
  );
}

function BotonGrande({
  children,
  onClick,
  apagado = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  apagado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={apagado}
      className={
        apagado
          ? "min-h-16 w-full rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-300"
          : "min-h-16 w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg font-bold text-slate-800 active:border-[#0088D1] active:bg-[#F5FBFE]"
      }
    >
      {children}
    </button>
  );
}
