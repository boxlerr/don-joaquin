"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Pencil, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import {
  buscarTarifa,
  calcularLitros,
  conviveConTiras,
  destinosTodos,
  origenesDe,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";
import {
  editarAutorizacionAction,
  eliminarAutorizacionAction,
  guardarAutorizacionAction,
  guardarTarifaAction,
  type AutorizacionRow,
  type ChoferOpcion,
} from "./actions";

/**
 * Autoconsumo — cuántos litros le corresponden a la vuelta.
 *
 * La forma sale de para quién es: **el que la va a tocar tiene el camión al
 * lado**. Dos gestos y un número grande. No hay desplegables para elegir el
 * tramo: con 3 canteras y 4 destinos, un `Combobox` son dos clics y un popup
 * para elegir entre algo que entra entero en la pantalla — y encima el del
 * proyecto ni siquiera dibuja buscador abajo de 7 opciones. Se toca el lugar.
 *
 * El umbral vive en el dominio (`conviveConTiras`): el día que las canteras sean
 * quince, esto vuelve solo al desplegable sin que nadie tenga que acordarse.
 *
 * Y no es una calculadora suelta: el coeficiente es **el mismo con el que YPF
 * liquida el autoconsumo** (verificado contra su reporte de agosto 2026:
 * 19.961 L ÷ 742,6 tn = 26,88, igual que la fila IBICUY→LAJE9 del cuadro). Cada
 * vuelta que se anota acá es una fila del reporte de conciliación que hay que
 * presentarle a YPF.
 */

const num = (n: number, dec = 1) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Rótulo de franja. Es el segundo y último nivel de la jerarquía. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Un lugar, como botón. El rinde va impreso abajo y el renglón se reserva
 * siempre: sin eso la tira cambia de alto al elegir origen y salta la pantalla.
 */
function BotonLugar({
  nombre,
  hint,
  activo,
  apagado,
  onClick,
}: {
  nombre: string;
  hint?: string;
  activo: boolean;
  apagado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={[
        "flex h-[46px] flex-col justify-center rounded-lg border px-2.5 text-left transition-colors",
        // Activo en neutro, nunca en color de marca: es la convención de los
        // filtros del resto del sistema.
        activo
          ? "border-foreground/25 bg-foreground/[0.06]"
          : "border-border bg-card hover:bg-muted/40",
        apagado ? "border-dashed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "truncate text-[13px] leading-tight",
          activo ? "font-semibold text-foreground" : "text-foreground",
          apagado ? "text-muted-foreground/60" : "",
        ].join(" ")}
      >
        {nombre}
      </span>
      <span className="mt-0.5 block h-[13px] truncate text-[11px] leading-none tabular-nums text-muted-foreground">
        {hint ?? ""}
      </span>
    </button>
  );
}

export default function AutoconsumoClient({
  tarifas,
  choferes,
  autorizaciones,
  canWrite,
}: {
  tarifas: TarifaGasoil[];
  choferes: ChoferOpcion[];
  autorizaciones: AutorizacionRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [toneladas, setToneladas] = useState("");
  const [choferId, setChoferId] = useState("");
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<{ litros: number; chofer: string | null } | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<AutorizacionRow | null>(null);
  const [borrando, setBorrando] = useState(false);
  const tnRef = useRef<HTMLInputElement>(null);

  const origenes = useMemo(() => origenesDe(tarifas), [tarifas]);
  const destinos = useMemo(() => destinosTodos(tarifas), [tarifas]);
  const conTiras = conviveConTiras(origenes.length, destinos.length);

  const tarifa = useMemo(
    () => buscarTarifa(tarifas, origenId, destinoId),
    [tarifas, origenId, destinoId],
  );
  const tn = toneladas.trim() === "" ? null : Number(toneladas.replace(",", "."));
  const calculo = useMemo(() => calcularLitros(tarifa, tn), [tarifa, tn]);

  const nombreOrigen = origenes.find((o) => o.id === origenId)?.nombre ?? "";
  const nombreDestino = destinos.find((d) => d.id === destinoId)?.nombre ?? "";

  /** El rinde de un destino para el origen elegido, o null si ese cruce no está. */
  const rindeDe = useCallback(
    (dId: string) => buscarTarifa(tarifas, origenId, dId)?.litrosPorTonelada ?? null,
    [tarifas, origenId],
  );

  // Elegir origen NO limpia el destino: si el cruce no existe, la pantalla lo
  // dice con nombre y apellido en vez de borrar lo que ya se había tocado.
  const elegirOrigen = (v: string) => {
    setOrigenId(v);
    setGuardado(null);
  };
  const elegirDestino = (v: string) => {
    setDestinoId(v);
    setGuardado(null);
    // El siguiente paso siempre es tipear las toneladas.
    requestAnimationFrame(() => tnRef.current?.focus());
  };

  /** Por qué no se puede anotar todavía. El botón nunca queda mudo. */
  const motivoBloqueo = (): string | null => {
    if (!origenId) return "Falta elegir de dónde salió.";
    if (!destinoId) return "Falta elegir a dónde va.";
    if (!tarifa) return "Ese tramo no tiene rinde cargado.";
    if (!calculo.ok) return calculo.mensaje;
    // Sin chofer la fila no sirve: el reporte de YPF se arma por chofer.
    if (!choferId) return "Falta elegir a qué chofer se le autoriza.";
    return null;
  };

  const guardar = useCallback(async () => {
    if (!calculo.ok || guardando || !choferId) return;
    setGuardando(true);
    setError(null);
    const payload = {
      choferId,
      origenId,
      destinoId,
      toneladas: calculo.toneladas,
      observaciones: obs,
    };
    const res = editandoId
      ? await editarAutorizacionAction(editandoId, payload)
      : await guardarAutorizacionAction(payload);
    setGuardando(false);
    if ("error" in res) return setError(res.error);
    setGuardado({
      litros: res.litros,
      chofer: choferes.find((c) => c.id === choferId)?.nombre ?? null,
    });
    // El tramo QUEDA elegido: cinco choferes del mismo tramo son cinco números,
    // no cinco veces todo de nuevo.
    setToneladas("");
    setChoferId("");
    setObs("");
    setEditandoId(null);
    router.refresh();
    requestAnimationFrame(() => tnRef.current?.focus());
  }, [calculo, guardando, choferId, origenId, destinoId, obs, choferes, router, editandoId]);

  /** Trae una fila ya anotada al formulario de arriba, para corregirla ahí mismo. */
  const editar = (f: AutorizacionRow) => {
    const t = tarifas.find((x) => x.origen === f.origen && x.destino === f.destino);
    setEditandoId(f.id);
    setOrigenId(t?.origenId ?? "");
    setDestinoId(t?.destinoId ?? "");
    setToneladas(String(f.toneladas));
    setChoferId(choferes.find((c) => c.nombre === f.chofer)?.id ?? "");
    setObs(f.observaciones ?? "");
    setGuardado(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setToneladas("");
    setChoferId("");
    setObs("");
    setError(null);
  };

  const borrar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    const res = await eliminarAutorizacionAction(aBorrar.id);
    setBorrando(false);
    setABorrar(null);
    if ("error" in res) return setError(res.error);
    if (editandoId === aBorrar.id) cancelarEdicion();
    router.refresh();
  };

  // Enter anota desde donde sea. El chofer no va a buscar el botón.
  const onKeyDownCampo = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void guardar();
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // `/` enfoca las toneladas. ⌘K NO se toca: es la paleta global.
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        tnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const bloqueo = motivoBloqueo();

  return (
    <div className="space-y-5">
      {/* ── La cuenta ─────────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border bg-card shadow-sm ${
          editandoId ? "border-foreground/30" : "border-border"
        }`}
      >
        {editandoId && (
          <p className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2 text-[13px] text-muted-foreground sm:px-5">
            <Pencil size={13} /> Estás corrigiendo una autorización ya anotada.
          </p>
        )}
        {/* Tramo */}
        <div className="space-y-3 p-4 sm:p-5">
          <div className="space-y-1.5">
            <Rotulo>Salió de</Rotulo>
            {conTiras ? (
              <div role="radiogroup" aria-label="Cantera de origen" className="grid grid-cols-3 gap-2">
                {origenes.map((o) => (
                  <BotonLugar
                    key={o.id}
                    nombre={o.nombre}
                    activo={o.id === origenId}
                    onClick={() => elegirOrigen(o.id)}
                  />
                ))}
              </div>
            ) : (
              <Combobox
                options={origenes.map((o) => ({ id: o.id, label: o.nombre }))}
                value={origenId}
                onValueChange={elegirOrigen}
                placeholder="Origen"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Rotulo>Va a</Rotulo>
            {conTiras ? (
              <div
                role="radiogroup"
                aria-label="Destino"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {destinos.map((d) => {
                  const r = rindeDe(d.id);
                  return (
                    <BotonLugar
                      key={d.id}
                      nombre={d.nombre}
                      // El rinde impreso es lo que convierte la tira en una
                      // tabla: se compara sin abrir nada.
                      hint={origenId ? (r != null ? `${num(r, 2)} L/tn` : "sin rinde") : undefined}
                      apagado={Boolean(origenId) && r == null}
                      activo={d.id === destinoId}
                      onClick={() => elegirDestino(d.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <Combobox
                options={destinos.map((d) => ({ id: d.id, label: d.nombre }))}
                value={destinoId}
                onValueChange={elegirDestino}
                placeholder="Destino"
              />
            )}
          </div>
        </div>

        {/* Toneladas y resultado */}
        <div className="grid items-end gap-4 border-t border-border/60 p-4 sm:p-5 lg:grid-cols-[190px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="tn">
              <Rotulo>Toneladas</Rotulo>
            </Label>
            <div className="relative">
              <Input
                id="tn"
                ref={tnRef}
                inputMode="decimal"
                value={toneladas}
                onChange={(e) => {
                  setToneladas(e.target.value);
                  setGuardado(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setToneladas("");
                  else onKeyDownCampo(e);
                }}
                // "35" a secas NO sirve de placeholder acá: con el campo
                // alineado a la derecha y en semibold se ve igual que un valor
                // cargado. Julián lo reportó el 01/09 — vio el 35, eligió el
                // tramo esperando el resultado, y el campo estaba vacío. El
                // "Ej." es lo que lo vuelve inequívocamente un ejemplo.
                placeholder="Ej. 35"
                autoComplete="off"
                aria-invalid={toneladas !== "" && !calculo.ok && Boolean(tarifa)}
                // 17px: arriba de los 16 que evitan el zoom de iOS, abajo del
                // titular. Si el input es más grande, compite con el resultado.
                // El placeholder se desmarca del valor: peso normal y más tenue.
                className="h-11 pr-9 text-right text-[17px] font-semibold tabular-nums placeholder:font-normal placeholder:text-muted-foreground/50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                tn
              </span>
            </div>
          </div>

          {/* Alto fijo en los tres estados: nada salta al escribir. */}
          <div className="min-h-[76px] space-y-1">
            <Rotulo>Le corresponden</Rotulo>
            {calculo.ok ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="text-[38px] font-semibold leading-none tabular-nums text-foreground sm:text-[44px]">
                    {num(calculo.litros)}
                  </span>
                  <span className="text-sm text-muted-foreground">litros</span>
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {nombreOrigen} → {nombreDestino} · {num(calculo.toneladas, 2)} tn ×{" "}
                  {num(calculo.litrosPorTonelada, 2)} L/tn
                </p>
              </>
            ) : (
              <p className="flex items-center gap-1.5 pt-1.5 text-sm">
                {calculo.error === "toneladas_fuera_de_rango" ? (
                  <>
                    <AlertTriangle size={14} className="shrink-0 text-destructive" />
                    <span className="text-destructive">{calculo.mensaje}</span>
                  </>
                ) : origenId && destinoId && !tarifa ? (
                  <>
                    <AlertTriangle size={14} className="shrink-0 text-[#B45309]" />
                    <span className="text-[#B45309]">
                      {nombreOrigen} → {nombreDestino} todavía no tiene un rinde cargado.
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {origenId && destinoId
                      ? "Poné cuántas toneladas cargó."
                      : "Elegí de dónde salió y a dónde va."}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Anotar */}
        {canWrite && (
          <div className="border-t border-border/60 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="chofer">
                  <Rotulo>A quién se le autoriza</Rotulo>
                </Label>
                {/* El único desplegable que queda, y acá sí corresponde: son 79. */}
                <Combobox
                  options={choferes.map((c) => ({ id: c.id, label: c.nombre }))}
                  value={choferId}
                  onValueChange={(v) => {
                    setChoferId(v);
                    setGuardado(null);
                  }}
                  placeholder="Buscar chofer"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obs">
                  <Rotulo>Nota (opcional)</Rotulo>
                </Label>
                <Input
                  id="obs"
                  value={obs}
                  onChange={(e) => {
                    setObs(e.target.value);
                    setGuardado(null);
                  }}
                  onKeyDown={onKeyDownCampo}
                  placeholder="Patente, remito, lo que sirva para encontrarlo después"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button onClick={() => void guardar()} disabled={Boolean(bloqueo) || guardando}>
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Anotar"}
              </Button>
              {editandoId && (
                <Button variant="outline" onClick={cancelarEdicion} disabled={guardando}>
                  <X size={14} /> Cancelar
                </Button>
              )}
              {/* El botón apagado siempre dice por qué. */}
              {bloqueo && !error && !guardado && (
                <span className="text-[11px] text-muted-foreground">{bloqueo}</span>
              )}
              {error && (
                <span className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertTriangle size={14} /> {error}
                </span>
              )}
              {guardado && !error && (
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <Check size={15} className="text-[#10B981]" />
                  Anotado: {num(guardado.litros)} litros
                  {guardado.chofer ? ` para ${guardado.chofer}` : ""}.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <Autorizadas
        filas={autorizaciones}
        canWrite={canWrite}
        editandoId={editandoId}
        onEditar={editar}
        onBorrar={setABorrar}
      />

      <ConfirmDialog
        open={aBorrar !== null}
        onOpenChange={(o) => !o && setABorrar(null)}
        title="¿Borrar esta autorización?"
        description={
          aBorrar
            ? `${aBorrar.chofer ?? "Sin chofer"} · ${aBorrar.origen} → ${aBorrar.destino} · ${num(aBorrar.litros)} litros. Queda registrado quién la borró y qué decía.`
            : undefined
        }
        loading={borrando}
        onConfirm={() => void borrar()}
      />
      <CuadroRindes tarifas={tarifas} canWrite={canWrite} origenes={origenes} destinos={destinos} />

      <p className="text-[13px] text-muted-foreground">
        El rinde de cada tramo es el mismo con el que YPF calcula los litros teóricos del
        autoconsumo. Cada vuelta que se anota acá es una fila del reporte que hay que
        presentarle.
      </p>
    </div>
  );
}

/** Lo que se autorizó. Con cero filas es un renglón, no una tabla vacía. */
function Autorizadas({
  filas,
  canWrite,
  editandoId,
  onEditar,
  onBorrar,
}: {
  filas: AutorizacionRow[];
  canWrite: boolean;
  editandoId: string | null;
  onEditar: (f: AutorizacionRow) => void;
  onBorrar: (f: AutorizacionRow) => void;
}) {
  const total = filas.reduce((a, f) => a + f.litros, 0);
  const cuando = (iso: string) => {
    const d = new Date(iso);
    const hoy = new Date();
    const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const mismoDia = d.toDateString() === hoy.toDateString();
    if (mismoDia) return `Hoy ${hora}`;
    return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${hora}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Lo que se autorizó</h2>
        {filas.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {filas.length} {filas.length === 1 ? "vuelta" : "vueltas"} · {num(total)} litros
          </span>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground sm:px-5">
          Todavía no anotaste ninguna. Cuando anotes una, queda acá con la hora y quién la cargó,
          para poder compararla después contra lo que cargó de verdad en el surtidor.
        </p>
      ) : (
        <>
          {/* Mobile: tarjetas. Una tabla de 7 columnas no existe en 375px. */}
          <ul className="divide-y divide-border/60 sm:hidden">
            {filas.map((f) => (
              <li key={f.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {f.chofer ?? "Sin chofer"}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {cuando(f.created_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] text-muted-foreground">
                    {f.origen} → {f.destino} · {num(f.toneladas, 2)} tn
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {num(f.litros)} L
                    </span>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditar(f)}
                          aria-label="Corregir"
                          className="ml-1 rounded p-1.5 text-muted-foreground"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBorrar(f)}
                          aria-label="Borrar"
                          className="rounded p-1.5 text-muted-foreground"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Cuándo</th>
                  <th className="px-3 py-2 text-left font-semibold">Chofer</th>
                  <th className="px-3 py-2 text-left font-semibold">Tramo</th>
                  <th className="px-3 py-2 text-right font-semibold">Tn</th>
                  <th className="px-3 py-2 text-right font-semibold">L/tn</th>
                  <th className="px-3 py-2 text-right font-semibold">Litros</th>
                  <th className="px-3 py-2 text-left font-semibold">Nota</th>
                  <th className="px-3 py-2 text-left font-semibold">Anotó</th>
                  {canWrite && <th className="w-20 px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-t border-border/60 ${
                      editandoId === f.id ? "bg-foreground/[0.04]" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {cuando(f.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">{f.chofer ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {f.origen} → {f.destino}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{num(f.toneladas, 2)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {num(f.litros_por_tonelada, 2)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                      {num(f.litros)}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{f.observaciones ?? ""}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {f.cargadoPor ?? "—"}
                    </td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => onEditar(f)}
                          title="Corregir esta autorización"
                          aria-label={`Corregir la autorización de ${f.chofer ?? "sin chofer"}`}
                          className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onBorrar(f)}
                          title="Borrar esta autorización"
                          aria-label={`Borrar la autorización de ${f.chofer ?? "sin chofer"}`}
                          className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * El cuadro de rindes, como CUADRO.
 *
 * En lista plana, IBICUY→LAJE9 (26,88) y SAN PEDRO→LAJE9 (26,51) quedan a seis
 * filas de distancia y no se comparan. En matriz están una arriba de la otra, y
 * ahí se ve de un vistazo qué cantera rinde más — que es la única pregunta que
 * alguien le hace a esta tabla.
 */
function CuadroRindes({
  tarifas,
  canWrite,
  origenes,
  destinos,
}: {
  tarifas: TarifaGasoil[];
  canWrite: boolean;
  origenes: { id: string; nombre: string }[];
  destinos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mapa = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tarifas) m.set(`${t.origenId}|${t.destinoId}`, t.litrosPorTonelada);
    return m;
  }, [tarifas]);

  const guardar = async (oId: string, dId: string) => {
    const n = Number(valor.replace(",", "."));
    setError(null);
    const res = await guardarTarifaAction({
      origenId: oId,
      destinoId: dId,
      litrosPorTonelada: n,
    });
    if ("error" in res) return setError(res.error);
    setEditando(null);
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Cuánto rinde cada tramo</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Litros de gasoil por tonelada. Cambiarlo acá no toca nada de lo ya autorizado.
        </p>
      </div>
      {error && <p className="px-4 pt-3 text-sm text-destructive sm:px-5">{error}</p>}

      <div className="p-4 sm:p-5">
        <HorizontalScrollHint fadeBg="from-card">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" />
                {destinos.map((d) => (
                  <th
                    key={d.id}
                    className="whitespace-nowrap bg-muted/40 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {d.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {origenes.map((o) => (
                <tr key={o.id}>
                  <th className="sticky left-0 z-10 whitespace-nowrap border-t border-border/60 bg-card px-3 py-2 text-left text-[13px] font-medium text-foreground">
                    {o.nombre}
                  </th>
                  {destinos.map((d) => {
                    const k = `${o.id}|${d.id}`;
                    const v = mapa.get(k);
                    const enEdicion = editando === k;
                    return (
                      <td
                        key={d.id}
                        className="h-9 border-t border-border/60 px-2 text-right tabular-nums"
                      >
                        {enEdicion ? (
                          <Input
                            autoFocus
                            inputMode="decimal"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            onBlur={() => setEditando(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void guardar(o.id, d.id);
                              if (e.key === "Escape") setEditando(null);
                            }}
                            className="ml-auto h-7 w-20 text-right text-xs"
                          />
                        ) : canWrite ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditando(k);
                              setValor(v != null ? String(v) : "");
                            }}
                            title={`Cambiar el rinde de ${o.nombre} → ${d.nombre}`}
                            className="group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-muted/60"
                          >
                            {v != null ? (
                              num(v, 2)
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                            <Pencil
                              size={11}
                              className="opacity-0 transition-opacity group-hover:opacity-60"
                            />
                          </button>
                        ) : v != null ? (
                          <span className="text-sm">{num(v, 2)}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScrollHint>

        <p className="mt-3 text-[11px] text-muted-foreground">
          {tarifas.length} tramos · {origenes.length} canteras × {destinos.length} destinos. En el
          resumen de YPF de agosto también aparecen Arenera Santa Rosa (21,69) y Arenera Cilio SA
          (21,65), que todavía no están acá.
        </p>
      </div>
    </div>
  );
}
