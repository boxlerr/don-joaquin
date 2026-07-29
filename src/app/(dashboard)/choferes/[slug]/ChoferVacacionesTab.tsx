"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Palmtree, Plus, Save, Trash2, Pencil, X, CalendarDays } from "lucide-react";
import CargarAusenciaDialog from "./CargarAusenciaDialog";
import {
  guardarSaldosAnioAction,
  reimputarPeriodoAction,
  editarAusenciaAction,
  cancelarAusenciaAction,
} from "./actions";
import type { Ausencia, VacacionesSaldo } from "./types";
import { formatFecha } from "@/lib/utils";
import {
  aniosCumplidos,
  hitoLabel,
  proximoHito,
  diasPorAntiguedad,
  venceSaldoLabel,
  saldosPorAnio,
  resumenSaldos,
} from "../vacaciones/derivar";

interface Props {
  chofer_id: string;
  saldo: VacacionesSaldo;
  ausencias: Ausencia[];
  can_write: boolean;
  fecha_ingreso?: string | null;
  onRefresh: () => void;
}

type FilaAnio = { anio: string; dias: string; observaciones: string };

export default function ChoferVacacionesTab({
  chofer_id,
  saldo,
  ausencias,
  can_write,
  fecha_ingreso,
  onRefresh,
}: Props) {
  const finPeriodoY = new Date().getFullYear();

  // Edición de los días que corresponden año por año: es lo que permite
  // arreglar a mano una carga inicial mal importada sin depender de un dev.
  const [editando, setEditando] = useState(false);
  const [filas, setFilas] = useState<FilaAnio[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Período cuyo año de imputación se está cambiando (id de la ausencia).
  const [reimputando, setReimputando] = useState<string | null>(null);
  // Período cuyas fechas se están corrigiendo acá mismo. Hasta ahora, para
  // arreglar un día mal cargado había que irse a la pestaña Ausencias: la
  // corrección más frecuente quedaba lejos justo de donde se ve el error.
  const [editandoFechas, setEditandoFechas] = useState<string | null>(null);
  const [fechas, setFechas] = useState({ inicio: "", fin: "" });
  const [guardandoFechas, setGuardandoFechas] = useState(false);
  // Período que se está por cancelar (los días vuelven al saldo del año).
  const [cancelando, setCancelando] = useState<Ausencia | null>(null);
  const [cancelandoLoading, setCancelandoLoading] = useState(false);

  // Períodos de vacaciones ya tomados (ausencias marcadas como vacaciones).
  const periodos = ausencias.filter((a) => a.es_vacaciones);

  // Mientras se editan los días, los totales se recalculan en vivo con el mismo
  // derivador del servidor: lo que se ve antes de guardar es lo que va a quedar.
  const filasNum = filas
    .map((f) => ({ anio: Number(f.anio), dias: Number(f.dias) || 0 }))
    .filter((f) => Number.isInteger(f.anio) && f.anio > 0);
  const saldosVista = editando
    ? saldosPorAnio(
        filasNum.map((f) => ({ anio: f.anio, dias: f.dias })),
        new Map(saldo.anios.map((a) => [a.anio, a.usados])),
      )
    : saldo.anios;
  const resumen = editando
    ? resumenSaldos(saldosVista, finPeriodoY)
    : {
        corresponden: saldo.dias_correspondientes,
        adeudados: saldo.dias_adeudados,
        disponibles: saldo.dias_disponibles,
        diasVencidos: saldo.dias_vencidos,
      };

  // Campos derivados de la antigüedad (mismos que la vista global de Vacaciones).
  const anios = fecha_ingreso ? aniosCumplidos(fecha_ingreso, finPeriodoY) : null;
  const hito = anios != null ? hitoLabel(anios) : "—";
  const proxHito = fecha_ingreso && anios != null ? proximoHito(fecha_ingreso, anios, finPeriodoY) : "—";
  const venceSaldo = venceSaldoLabel(resumen.adeudados, finPeriodoY);
  const diasAntig = anios != null ? diasPorAntiguedad(anios) : resumen.corresponden;
  const desfasaje = resumen.corresponden > 0 && anios != null && diasAntig !== resumen.corresponden;

  // Explica de dónde sale "disponibles", año por año. Sin esto, ver
  // "Corresponden 14" al lado de "Disponibles 7" parece un error del sistema.
  const cuentaSaldo = (() => {
    const vigentes = saldosVista.filter((a) => a.anio >= finPeriodoY - 1 && a.anio <= finPeriodoY);
    if (vigentes.length === 0) return null;
    const partes = vigentes.map((a) =>
      a.usados > 0
        ? `del ${a.anio} le tocaban ${a.otorgados} y ya se tomó ${a.usados}, quedan ${a.saldo}`
        : `del ${a.anio} le tocan ${a.otorgados} y no se tomó ninguno`,
    );
    const total = vigentes.reduce((s, a) => s + a.saldo, 0);
    return vigentes.length === 1
      ? `${partes[0]!.charAt(0).toUpperCase()}${partes[0]!.slice(1)}.`
      : `${partes.join("; ")}. En total le quedan ${total} día${total === 1 ? "" : "s"}.`;
  })();

  // Años que se le pueden asignar a un período: los que ya tiene cargados más el
  // año en curso y el anterior, para no quedar limitada a lo que existe hoy.
  const aniosDisponibles = [
    ...new Set([...saldo.anios.map((a) => a.anio), finPeriodoY, finPeriodoY - 1]),
  ].sort((a, b) => b - a);

  const abrirEdicion = () => {
    setFilas(
      (saldo.anios.length > 0
        ? saldo.anios
        : [{ anio: finPeriodoY, otorgados: diasAntig, usados: 0, saldo: 0, observaciones: null }]
      ).map((a) => ({
        anio: String(a.anio),
        dias: String(a.otorgados),
        observaciones: a.observaciones ?? "",
      })),
    );
    setError(null);
    setEditando(true);
  };

  const guardar = async () => {
    setSaving(true);
    setError(null);
    const res = await guardarSaldosAnioAction(
      chofer_id,
      filas.map((f) => ({
        anio: Number(f.anio),
        dias: Number(f.dias) || 0,
        observaciones: f.observaciones || null,
      })),
    );
    setSaving(false);
    if (res.error) setError(res.error);
    else {
      setEditando(false);
      onRefresh();
    }
  };

  const cambiarImputacion = async (id: string, valor: string) => {
    setReimputando(null);
    setError(null);
    const res = await reimputarPeriodoAction(id, chofer_id, valor === "hist" ? null : Number(valor));
    if (res.error) setError(res.error);
    else onRefresh();
  };

  // Mismo cálculo inclusivo que hace el servidor: del 30/03 al 05/04 son 7 días,
  // no 6. Se recalcula mientras se tipea para que el número de días que va a
  // quedar se vea antes de guardar.
  const diasEntre = (inicio: string, fin: string) => {
    if (!inicio || !fin) return 0;
    const ini = new Date(inicio + "T00:00:00").getTime();
    const f = new Date(fin + "T00:00:00").getTime();
    if (Number.isNaN(ini) || Number.isNaN(f) || f < ini) return 0;
    return Math.max(1, Math.round((f - ini) / 86_400_000) + 1);
  };

  const abrirFechas = (a: Ausencia) => {
    setReimputando(null);
    setEditandoFechas(a.id);
    setFechas({ inicio: a.fecha_inicio, fin: a.fecha_fin });
    setError(null);
  };

  const guardarFechas = async (a: Ausencia) => {
    if (!fechas.inicio || !fechas.fin) {
      setError("Faltan las fechas del período.");
      return;
    }
    if (fechas.fin < fechas.inicio) {
      setError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }
    setGuardandoFechas(true);
    setError(null);
    // `anio_cargo` va sin definir a propósito: mover las fechas no tiene por qué
    // cambiar de qué año descuenta el período. Eso se decide con el otro botón.
    const res = await editarAusenciaAction(a.id, chofer_id, {
      tipo: a.tipo,
      fecha_inicio: fechas.inicio,
      fecha_fin: fechas.fin,
      observaciones: a.observaciones,
      es_vacaciones: true,
      justificada: a.justificada,
    });
    setGuardandoFechas(false);
    if (res.error) setError(res.error);
    else {
      setEditandoFechas(null);
      onRefresh();
    }
  };

  const confirmarCancelacion = async () => {
    if (!cancelando) return;
    setCancelandoLoading(true);
    setError(null);
    const res = await cancelarAusenciaAction(cancelando.id, chofer_id);
    setCancelandoLoading(false);
    if (res.error) setError(res.error);
    else {
      setCancelando(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palmtree size={16} className="text-primary" />
          Saldo de vacaciones
        </h3>
        {can_write && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={13} className="mr-1.5 text-primary" />
            Cargar vacaciones
          </Button>
        )}
      </div>

      {/* Resumen de saldo. "Disponibles" es el saldo vigente que queda por año
          (Y e Y−1): NO se le vuelven a restar los tomados, porque esos días ya
          están descontados del año al que se imputaron. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SaldoCard
          label={`Corresponden (${finPeriodoY})`}
          value={resumen.corresponden}
          tone="muted"
          hint={`Los días que le tocan por ${finPeriodoY} según su antigüedad. Es el total del año, no lo que le queda.`}
        />
        <SaldoCard label={`Adeudados (${finPeriodoY - 1})`} value={resumen.adeudados} tone="muted" />
        <SaldoCard
          label="Tomados"
          value={saldo.dias_tomados}
          tone="warning"
          hint={`Días de vacaciones que arrancaron en ${finPeriodoY}, sin importar de qué año descuenten.`}
        />
        <SaldoCard
          label="Disponibles"
          value={resumen.disponibles}
          tone={resumen.disponibles < 0 ? "error" : "success"}
          hint={`Suma de lo que queda del ${finPeriodoY} y del ${finPeriodoY - 1}.`}
        />
      </div>
      {/* La cuenta escrita. "Corresponden 14" al lado de "Disponibles 7" se lee
          como una contradicción si no se ve de dónde sale cada número: son los
          días del año contra lo que queda después de lo tomado. */}
      {cuentaSaldo && (
        <p className="border-l-2 border-primary/40 pl-3 text-[13px] leading-snug text-muted-foreground">
          {cuentaSaldo}
        </p>
      )}
      {resumen.diasVencidos > 0 && (
        <p className="text-xs text-muted-foreground">
          Además tiene <span className="font-mono font-medium text-foreground">{resumen.diasVencidos}</span> día(s)
          de años anteriores a {finPeriodoY - 1} que ya vencieron y no cuentan como disponibles.
        </p>
      )}

      {/* Antigüedad / hito / vencimientos (derivados del ingreso) */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-[8px] border border-border bg-muted/20 px-4 py-3 text-sm">
        <InfoChip label="Antigüedad" value={anios != null ? `${anios} año${anios !== 1 ? "s" : ""}` : "—"} />
        <InfoChip label="Hito" value={hito} />
        <InfoChip
          label="Vence saldo anterior"
          value={venceSaldo ?? "—"}
          tone={venceSaldo ? "danger" : undefined}
        />
        <InfoChip label="Próximo hito" value={proxHito} />
        {desfasaje && (
          <InfoChip
            label="Por antigüedad"
            value={`Le corresponderían ${diasAntig} días`}
            tone="warning"
          />
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-[6px]">{error}</div>
      )}

      {/* Días que corresponden, año por año. Editable: los otorgados de cada año
          son la carga inicial de la planilla y a veces vienen mal. */}
      <div className="bg-card rounded-[8px] border border-border overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Días por año</h4>
          <span className="text-xs text-muted-foreground">otorgados − tomados de ese año = saldo</span>
          {can_write && (
            <div className="ml-auto flex items-center gap-1.5">
              {editando ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditando(false);
                      setError(null);
                    }}
                    disabled={saving}
                    className="h-7 text-xs text-muted-foreground border-border"
                  >
                    <X size={13} className="mr-1" /> Cancelar
                  </Button>
                  <Button variant="brand" size="sm" onClick={guardar} disabled={saving} className="h-7 text-xs">
                    <Save size={13} className="mr-1" />
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={abrirEdicion}
                  className="h-7 text-xs text-muted-foreground border-border"
                >
                  <Pencil size={12} className="mr-1" /> Editar días
                </Button>
              )}
            </div>
          )}
        </div>

        {editando ? (
          <div className="p-4 space-y-2">
            {filas.map((f, i) => {
              const usados = saldo.anios.find((a) => a.anio === Number(f.anio))?.usados ?? 0;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    value={f.anio}
                    onChange={(e) =>
                      setFilas((p) => p.map((x, j) => (j === i ? { ...x, anio: e.target.value } : x)))
                    }
                    className="w-24 font-mono"
                    aria-label="Año"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={f.dias}
                    onChange={(e) =>
                      setFilas((p) => p.map((x, j) => (j === i ? { ...x, dias: e.target.value } : x)))
                    }
                    className="w-20 font-mono text-right"
                    aria-label="Días que corresponden"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-28">
                    {usados > 0 ? `${usados} tomados` : "sin tomar"}
                  </span>
                  <Input
                    value={f.observaciones}
                    onChange={(e) =>
                      setFilas((p) => p.map((x, j) => (j === i ? { ...x, observaciones: e.target.value } : x)))
                    }
                    placeholder="Observación (opcional)"
                    className="flex-1 min-w-[10rem]"
                    aria-label="Observación"
                  />
                  <button
                    type="button"
                    onClick={() => setFilas((p) => p.filter((_, j) => j !== i))}
                    title={usados > 0 ? "Tiene vacaciones imputadas: primero cambiá de qué año descuentan" : "Quitar el año"}
                    className="text-muted-foreground hover:text-[#EF4444] shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilas((p) => {
                  // Propone el año vigente que falte (el anterior primero), no el
                  // siguiente: un año futuro no suma a los días disponibles y
                  // sugerirlo por defecto sólo confunde.
                  const cargados = new Set(p.map((x) => Number(x.anio)));
                  const sugerido =
                    [finPeriodoY - 1, finPeriodoY].find((y) => !cargados.has(y)) ??
                    Math.min(...[...cargados].filter(Number.isFinite), finPeriodoY) - 1;
                  return [...p, { anio: String(sugerido), dias: String(diasAntig), observaciones: "" }];
                })
              }
              className="h-7 text-xs text-muted-foreground border-border"
            >
              <Plus size={12} className="mr-1" /> Agregar año
            </Button>
            <p className="text-xs text-muted-foreground pt-1">
              Los <span className="font-medium">tomados</span> salen solos de las vacaciones cargadas. Un año
              con vacaciones imputadas no se puede quitar: primero cambiá de qué año descuenta ese período,
              más abajo.
            </p>
          </div>
        ) : saldosVista.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Sin días cargados todavía.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
            {saldosVista.map((a) => {
              const vencido = a.anio < finPeriodoY - 1;
              return (
                <span
                  key={a.anio}
                  title={
                    (vencido ? `Venció el 31/12/${a.anio + 1}. ` : "") +
                    (a.observaciones ?? "")
                  }
                  className={`px-2 py-0.5 rounded-[4px] border font-mono ${
                    vencido
                      ? "bg-muted text-muted-foreground/60 border-border line-through"
                      : a.saldo > 0
                        ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                        : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {a.anio}: {a.saldo} de {a.otorgados}
                  {a.usados > 0 ? ` (usados ${a.usados})` : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Listado de vacaciones tomadas */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">
          Vacaciones cargadas
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {periodos.length} período{periodos.length !== 1 ? "s" : ""}
          </span>
        </h4>
        {periodos.length === 0 ? (
          <EmptyState icon={Palmtree} message="Sin vacaciones cargadas" />
        ) : (
          <div className="space-y-2">
            {periodos.map((a) => (
              <div
                key={a.id}
                className="bg-card rounded-[8px] border border-border p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {editandoFechas === a.id ? (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <Input
                        type="date"
                        value={fechas.inicio}
                        onChange={(e) => setFechas((p) => ({ ...p, inicio: e.target.value }))}
                        className="h-7 w-[8.75rem] text-xs"
                        aria-label="Desde"
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        type="date"
                        value={fechas.fin}
                        min={fechas.inicio || undefined}
                        onChange={(e) => setFechas((p) => ({ ...p, fin: e.target.value }))}
                        className="h-7 w-[8.75rem] text-xs"
                        aria-label="Hasta"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {diasEntre(fechas.inicio, fechas.fin)} día
                        {diasEntre(fechas.inicio, fechas.fin) !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="brand"
                        size="sm"
                        onClick={() => guardarFechas(a)}
                        disabled={guardandoFechas}
                        className="h-7 text-xs"
                      >
                        <Save size={12} className="mr-1" />
                        {guardandoFechas ? "Guardando…" : "Guardar"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditandoFechas(null)}
                        disabled={guardandoFechas}
                        title="Cancelar la edición"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!can_write}
                        onClick={() => can_write && abrirFechas(a)}
                        title={can_write ? "Corregir las fechas de este período" : undefined}
                        className={`text-sm text-foreground text-left ${
                          can_write ? "hover:text-primary cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {formatFecha(a.fecha_inicio)}
                        <span className="text-muted-foreground mx-1.5">→</span>
                        {formatFecha(a.fecha_fin)}
                        {can_write && (
                          <CalendarDays size={11} className="inline ml-1.5 align-baseline text-muted-foreground" />
                        )}
                      </button>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                        {a.dias} día{a.dias !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {a.en_curso && editandoFechas !== a.id && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                      En curso
                    </span>
                  )}
                  {/* De qué año descuenta. Editable: la imputación automática
                      (y el importador de la planilla) a veces le pegan al año
                      equivocado y hasta ahora no había forma de corregirlo. */}
                  {editandoFechas === a.id ? null : reimputando === a.id ? (
                    <span className="inline-flex items-center gap-1">
                      <select
                        autoFocus
                        defaultValue={a.anio_cargo != null ? String(a.anio_cargo) : "hist"}
                        onChange={(e) => cambiarImputacion(a.id, e.target.value)}
                        className="h-7 rounded-[4px] border border-border bg-background px-2 text-xs text-foreground"
                      >
                        {aniosDisponibles.map((y) => (
                          <option key={y} value={y}>
                            Descuenta del {y}
                          </option>
                        ))}
                        <option value="hist">Histórico (no descuenta)</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setReimputando(null)}
                        title="Cancelar"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!can_write}
                      onClick={() => can_write && setReimputando(a.id)}
                      title={
                        can_write
                          ? "Cambiar de qué año descuenta este período"
                          : a.anio_cargo != null
                            ? `Descuenta del saldo ${a.anio_cargo}`
                            : "Histórico — ya está reflejado en el saldo"
                      }
                      className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-muted text-muted-foreground border border-border ${
                        can_write ? "hover:border-primary/50 hover:text-foreground cursor-pointer" : ""
                      }`}
                    >
                      {a.anio_cargo != null ? `Saldo ${a.anio_cargo}` : "Histórico"}
                      {can_write && <Pencil size={9} className="inline ml-1 align-baseline" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  {a.autorizado_por_nombre && (
                    <span className="text-xs text-muted-foreground">
                      Autorizó: {a.autorizado_por_nombre}
                    </span>
                  )}
                  {can_write && editandoFechas !== a.id && (
                    <button
                      type="button"
                      onClick={() => setCancelando(a)}
                      title="Cancelar este período (los días vuelven al saldo)"
                      className="text-muted-foreground hover:text-[#EF4444] shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Clic en las <span className="font-medium">fechas</span> para corregirlas, y en{" "}
          <span className="font-medium">Saldo {finPeriodoY}</span> /{" "}
          <span className="font-medium">Histórico</span> para cambiar de qué año descuenta el período.
          Las vacaciones se cargan como una ausencia (también aparecen en Logística / Viajes).
        </p>
      </div>

      <CargarAusenciaDialog
        chofer_id={chofer_id}
        ausencia={null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultVacaciones
        onSuccess={() => {
          setDialogOpen(false);
          onRefresh();
        }}
      />

      <ConfirmDialog
        open={cancelando != null}
        onOpenChange={(o) => !o && setCancelando(null)}
        title="Cancelar período de vacaciones"
        description={
          cancelando ? (
            <>
              Del {formatFecha(cancelando.fecha_inicio)} al {formatFecha(cancelando.fecha_fin)} (
              {cancelando.dias} día{cancelando.dias !== 1 ? "s" : ""}).{" "}
              {cancelando.anio_cargo != null
                ? `Los días vuelven al saldo ${cancelando.anio_cargo}.`
                : "Era un período histórico, así que el saldo no se mueve."}
            </>
          ) : null
        }
        confirmLabel="Cancelar período"
        cancelLabel="Volver"
        loading={cancelandoLoading}
        onConfirm={confirmarCancelacion}
      />
    </div>
  );
}

function SaldoCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "error";
  hint?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-[#065F46]"
      : tone === "warning"
        ? "text-[#92400E]"
        : tone === "error"
          ? "text-[#991B1B]"
          : "text-foreground";
  return (
    <div className="rounded-[8px] border border-border bg-card p-3" title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function InfoChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warning";
}) {
  const valueClass =
    tone === "danger" ? "text-[#EF4444] font-semibold" : tone === "warning" ? "text-amber-600 font-semibold" : "text-foreground";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}
