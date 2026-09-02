"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buscarTarifa,
  calcularLitros,
  destinosTodos,
  origenesDe,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";
import { filtrarChoferes } from "@/domain/gasoil/enlace";
import { calcularSaldo, rotuloDeSaldo } from "@/domain/gasoil/saldo";
import { anotarCargaChoferAction, anotarVueltaChoferAction, misVueltasAction } from "./actions";
import type { ChoferParaEnlace, VueltaDelChofer } from "./tipos";

/**
 * La pantalla que abre el chofer.
 *
 * Está escrita para alguien parado al lado del camión, con una mano, con sol en
 * la pantalla y sin ganas de pelear con un teléfono. De ahí sale todo lo demás:
 *
 *  * **Lo primero que ve es su vuelta de hoy y cuántos litros le quedan.** No un
 *    formulario en blanco: el que abre esto a las tres de la tarde ya anotó la
 *    vuelta a la mañana y viene a ver el saldo. El formulario está a un toque.
 *  * **Una pregunta a la vez** cuando sí anota una vuelta. Los pasos aparecen de
 *    a uno y el anterior se achica a un renglón con "Cambiar".
 *  * **Nada de desplegables.** Las canteras y los destinos entran enteros en la
 *    pantalla como botones grandes; un `<select>` nativo en Android es una rueda
 *    diminuta.
 *  * **El teléfono se acuerda de quién es.** Elegirse entre 61 nombres una vez
 *    está bien; en cada vuelta, no.
 *
 * El saldo que muestra sale de lo que el propio chofer declaró, no del reporte
 * de YPF —que llega a día vencido—. Es a propósito y es la única forma de que el
 * número sirva en el momento; la conciliación contra YPF se hace después.
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

const soloNumero = (v: string) => v.replace(/[^\d.,]/g, "");

export default function CargaChoferClient({
  token,
  tarifas,
  choferes,
}: {
  token: string;
  tarifas: TarifaGasoil[];
  choferes: ChoferParaEnlace[];
}) {
  const [hidratado, setHidratado] = useState(false);
  const [choferId, setChoferId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [vueltas, setVueltas] = useState<VueltaDelChofer[] | null>(null);
  const [modo, setModo] = useState<"inicio" | "nueva">("inicio");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chofer = choferes.find((c) => c.id === choferId) ?? null;

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

  const traerVueltas = useCallback(
    async (id: string) => {
      const r = await misVueltasAction({ token, choferId: id });
      if (r.ok) setVueltas(r.vueltas);
      else setError(r.mensaje);
    },
    [token],
  );

  useEffect(() => {
    if (!choferId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- traer el historial al identificarse */
    setVueltas(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    void traerVueltas(choferId);
  }, [choferId, traerVueltas]);

  function elegirChofer(id: string) {
    setChoferId(id);
    setEligiendo(false);
    setBusqueda("");
    setModo("inicio");
    try {
      localStorage.setItem(RECUERDO, id);
    } catch {
      // Sin almacenamiento igual funciona: sólo hay que elegirse de nuevo.
    }
  }

  const listaFiltrada = useMemo(
    () => filtrarChoferes(choferes, busqueda),
    [choferes, busqueda],
  );

  if (!hidratado) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden />;
  }

  // ── 1 · Quién sos ──────────────────────────────────────────────────────────
  if (!chofer || eligiendo) {
    return (
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
    );
  }

  // ── 2 · Anotar una vuelta nueva ────────────────────────────────────────────
  if (modo === "nueva") {
    return (
      <VueltaNueva
        token={token}
        chofer={chofer}
        tarifas={tarifas}
        onListo={async (texto) => {
          setAviso(texto);
          setModo("inicio");
          await traerVueltas(chofer.id);
        }}
        onCancelar={() => setModo("inicio")}
      />
    );
  }

  // ── 3 · Lo que ya tiene: su vuelta de hoy y el historial ───────────────────
  const deHoy = (vueltas ?? []).filter((v) => v.enCurso);
  const antes = (vueltas ?? []).filter((v) => !v.enCurso);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xl font-bold text-slate-900">Hola, {primerNombre(chofer.nombre)}</p>
        <button
          type="button"
          onClick={() => {
            setEligiendo(true);
            setBusqueda("");
          }}
          className="shrink-0 text-base font-bold text-[#0088D1]"
        >
          No soy yo
        </button>
      </div>

      {aviso && (
        <p className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-800">
          {aviso}
        </p>
      )}
      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      )}

      {vueltas === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" aria-hidden />
      ) : (
        <>
          {deHoy.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 px-5 py-8 text-center">
              <p className="text-lg font-bold text-slate-800">Hoy todavía no anotaste ninguna vuelta</p>
              <p className="mt-1 text-base text-slate-500">
                Anotala y te digo cuántos litros podés cargar.
              </p>
            </div>
          ) : (
            deHoy.map((v) => (
              <TarjetaVuelta
                key={v.id}
                vuelta={v}
                token={token}
                choferId={chofer.id}
                onCargado={(vs) => {
                  setVueltas(vs);
                  setAviso("Listo, anotamos la carga.");
                }}
                onError={setError}
              />
            ))
          )}

          <button
            type="button"
            onClick={() => {
              setAviso(null);
              setError(null);
              setModo("nueva");
            }}
            className="h-16 w-full rounded-2xl bg-[#0088D1] text-xl font-bold text-white active:bg-[#0277BD]"
          >
            Anotar una vuelta
          </button>

          {antes.length > 0 && (
            <section className="pt-2">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
                Tus vueltas de antes
              </h2>
              <div className="divide-y divide-slate-100 rounded-xl border-2 border-slate-200">
                {antes.map((v) => {
                  const s = calcularSaldo(v.litros, v.cargas);
                  return (
                    <div key={v.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-base font-bold text-slate-800">
                          {diaCorto(v.fecha)} · {v.cantera} → {v.destino}
                        </span>
                        <span className="shrink-0 text-base font-bold tabular-nums text-slate-800">
                          {n1(v.litros)} L
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm text-slate-500">
                        {n1(v.toneladas)} tn ·{" "}
                        {s.sinCargas
                          ? "no anotaste ninguna carga"
                          : `cargaste ${n1(s.cargados)}${s.excedido ? " — te pasaste" : ""}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── La vuelta de hoy, con el saldo ──────────────────────────────────────────

/**
 * El saldo de una vuelta y el botón para descontarle una carga.
 *
 * El número grande es lo que le queda, no lo que le corresponde: parado en el
 * surtidor, lo primero que necesita saber es cuánto puede meter ahora.
 */
function TarjetaVuelta({
  vuelta,
  token,
  choferId,
  onCargado,
  onError,
}: {
  vuelta: VueltaDelChofer;
  token: string;
  choferId: string;
  onCargado: (vueltas: VueltaDelChofer[]) => void;
  onError: (m: string) => void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [litros, setLitros] = useState("");
  const [guardando, setGuardando] = useState(false);

  const s = calcularSaldo(vuelta.litros, vuelta.cargas);
  const rot = rotuloDeSaldo(s);
  const nuevos = aNumero(litros);

  async function guardar() {
    if (!nuevos || nuevos <= 0) return;
    setGuardando(true);
    const r = await anotarCargaChoferAction({
      token,
      choferId,
      autorizacionId: vuelta.id,
      litros: nuevos,
    });
    setGuardando(false);
    if (r.ok) {
      setLitros("");
      setAbriendo(false);
      onCargado(r.vueltas);
    } else {
      onError(r.mensaje);
    }
  }

  return (
    <div
      className={`rounded-2xl border-2 px-5 py-6 ${
        s.excedido ? "border-red-400 bg-red-50" : "border-[#0088D1] bg-[#F5FBFE]"
      }`}
    >
      <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Hoy · {vuelta.cantera} → {vuelta.destino} · {n1(vuelta.toneladas)} tn
      </div>

      <div className="mt-4 text-center">
        <div
          className={`text-sm font-semibold uppercase tracking-wide ${
            s.excedido ? "text-red-700" : "text-[#0088D1]"
          }`}
        >
          {rot.titulo}
        </div>
        <div className="mt-1 text-6xl font-bold leading-none text-slate-900">
          {n1(Math.abs(s.restantes))}
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-500">litros</div>
        <p className="mt-2 text-base text-slate-600">{rot.detalle}</p>
      </div>

      {/* La barra es para leer de un vistazo cuánto va: el número exacto ya está
          arriba. Se llena hasta el tope aunque se haya pasado — el exceso se dice
          con palabras y con el color, no estirando la barra fuera de la caja. */}
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
        <div
          className={`h-full ${s.excedido ? "bg-red-500" : "bg-[#0088D1]"}`}
          style={{ width: `${Math.min(s.usadoPct ?? 0, 100)}%` }}
        />
      </div>

      {vuelta.cargas.length > 0 && (
        <ul className="mt-4 space-y-1">
          {vuelta.cargas.map((c) => (
            <li key={c.id} className="flex justify-between gap-3 text-base text-slate-600">
              <span>{c.previa ? "Traías cargado" : `Cargaste ${c.hora}`}</span>
              <span className="font-semibold tabular-nums">{n1(c.litros)} L</span>
            </li>
          ))}
        </ul>
      )}

      {abriendo ? (
        <div className="mt-5">
          <label className="mb-2 block text-base font-bold text-slate-800">
            ¿Cuántos litros cargaste?
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={litros}
              onChange={(e) => setLitros(soloNumero(e.target.value))}
              placeholder="300"
              className="h-20 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-center text-4xl font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:border-[#0088D1] focus:outline-none"
            />
            <span className="text-2xl font-semibold text-slate-400">L</span>
          </div>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setAbriendo(false);
                setLitros("");
              }}
              className="h-14 flex-1 rounded-xl border-2 border-slate-300 bg-white text-lg font-bold text-slate-600 active:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!nuevos || nuevos <= 0 || guardando}
              className="h-14 flex-[2] rounded-xl bg-[#0088D1] text-lg font-bold text-white active:bg-[#0277BD] disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Anotar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbriendo(true)}
          className="mt-5 h-16 w-full rounded-xl border-2 border-[#0088D1] bg-white text-lg font-bold text-[#0088D1] active:bg-[#E7F5FD]"
        >
          Cargué gasoil
        </button>
      )}
    </div>
  );
}

// ── Anotar una vuelta ───────────────────────────────────────────────────────

function VueltaNueva({
  token,
  chofer,
  tarifas,
  onListo,
  onCancelar,
}: {
  token: string;
  chofer: ChoferParaEnlace;
  tarifas: TarifaGasoil[];
  onListo: (aviso: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [toneladas, setToneladas] = useState("");
  const [previos, setPrevios] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  const origenes = useMemo(() => origenesDe(tarifas), [tarifas]);
  const destinos = useMemo(() => destinosTodos(tarifas), [tarifas]);

  const tarifa = buscarTarifa(tarifas, origenId, destinoId);
  const calculo = calcularLitros(tarifa, aNumero(toneladas));

  // Cuando aparece un paso nuevo, se lo trae a la vista. Sin esto, en un teléfono
  // chico la pregunta siguiente nace abajo del borde y parece que no pasó nada.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [origenId, destinoId]);

  async function anotar() {
    if (!origenId || !destinoId || !calculo.ok) return;
    setEnviando(true);
    setError(null);
    const r = await anotarVueltaChoferAction({
      token,
      choferId: chofer.id,
      origenId,
      destinoId,
      toneladas: calculo.toneladas,
      litrosPrevios: aNumero(previos),
    });
    setEnviando(false);
    if (r.ok) {
      await onListo(
        r.vuelta.yaEstaba
          ? "Esa vuelta ya estaba anotada, no la duplicamos."
          : "Listo, quedó anotada la vuelta.",
      );
    } else {
      setError(r.mensaje);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onCancelar}
        className="text-base font-bold text-[#0088D1]"
      >
        ← Volver
      </button>

      {origenId ? (
        <Elegido
          etiqueta="Saliste de"
          valor={origenes.find((o) => o.id === origenId)?.nombre ?? ""}
          onCambiar={() => {
            setOrigenId(null);
            setDestinoId(null);
          }}
        />
      ) : (
        <Paso numero={1} pregunta="¿De dónde saliste?">
          <div className="grid gap-3">
            {origenes.map((o) => (
              <BotonGrande key={o.id} onClick={() => setOrigenId(o.id)}>
                {o.nombre}
              </BotonGrande>
            ))}
          </div>
        </Paso>
      )}

      {origenId &&
        (destinoId ? (
          <Elegido
            etiqueta="Vas a"
            valor={destinos.find((d) => d.id === destinoId)?.nombre ?? ""}
            onCambiar={() => setDestinoId(null)}
          />
        ) : (
          <Paso numero={2} pregunta="¿A dónde vas?">
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

      {origenId && destinoId && (
        <Paso numero={3} pregunta="¿Cuántas toneladas cargaste?">
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={toneladas}
              onChange={(e) => setToneladas(soloNumero(e.target.value))}
              placeholder="35"
              aria-label="Toneladas"
              className="h-20 w-full rounded-xl border-2 border-slate-300 px-4 text-center text-4xl font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:border-[#0088D1] focus:outline-none"
            />
            <span className="text-2xl font-semibold text-slate-400">tn</span>
          </div>

          {toneladas.trim() !== "" && (
            <div className="mt-5">
              {calculo.ok ? (
                <div className="rounded-2xl border-2 border-[#0088D1] bg-[#F5FBFE] px-5 py-6 text-center">
                  <div className="text-sm font-semibold uppercase tracking-wide text-[#0088D1]">
                    Te corresponden
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

      {/* Los litros que ya traía. Va acá y no como paso obligatorio porque la
          mayoría de las vueltas arrancan sin nada cargado: preguntárselo siempre
          sería un paso de más para el caso normal. */}
      {calculo.ok && (
        <div className="rounded-xl border-2 border-slate-200 px-4 py-4">
          <label className="block text-base font-bold text-slate-800">
            ¿Ya habías cargado gasoil antes de la arena?
          </label>
          <p className="mt-0.5 text-sm text-slate-500">
            Si no, dejalo vacío. Se le descuenta a la vuelta.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={previos}
              onChange={(e) => setPrevios(soloNumero(e.target.value))}
              placeholder="0"
              aria-label="Litros que ya traías cargados"
              className="h-16 w-full rounded-xl border-2 border-slate-300 px-4 text-center text-3xl font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:border-[#0088D1] focus:outline-none"
            />
            <span className="text-xl font-semibold text-slate-400">L</span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-base text-red-800">
          {error}
        </p>
      )}

      {calculo.ok && (
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

/** "Asteazarán Cristian Antonio" → "Cristian". La lista va Apellido Nombre. */
function primerNombre(completo: string): string {
  const partes = completo.trim().split(/\s+/);
  return partes.length > 1 ? partes[1]! : partes[0]!;
}

/** "2026-09-01" → "1/9". */
function diaCorto(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${Number(d)}/${Number(m)}`;
}

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
