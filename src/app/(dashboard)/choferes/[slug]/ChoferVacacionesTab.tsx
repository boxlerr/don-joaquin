"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Palmtree, Plus, Save, Trash2, Pencil, X, CalendarDays, RotateCcw } from "lucide-react";
import CargarAusenciaDialog from "./CargarAusenciaDialog";
import {
  guardarSaldosAnioAction,
  reimputarPeriodoAction,
  editarAusenciaAction,
  cancelarAusenciaAction,
  historialAnioAction,
  type MovimientoAnio,
} from "./actions";
import type { Ausencia, VacacionesSaldo } from "./types";
import { formatFecha } from "@/lib/utils";
import {
  aniosCumplidos,
  diasPorAntiguedad,
  diasPorAntiguedadEnAnio,
  chequeoLey,
  explicarAntiguedad,
  saldosPorAnio,
  resumenSaldos,
  type OrigenDias,
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
  // Historial de movimientos de un año, desplegado bajo su fila. Se pide sólo
  // cuando lo abren: son 30 filas de audit_log por año y nadie las mira siempre.
  const [historialAnio, setHistorialAnio] = useState<number | null>(null);
  const [historial, setHistorial] = useState<Record<number, MovimientoAnio[] | "cargando">>({});

  // Períodos de vacaciones ya tomados (ausencias marcadas como vacaciones).
  const periodos = ausencias.filter((a) => a.es_vacaciones);

  // Mientras se editan los días, los totales se recalculan en vivo con el mismo
  // derivador del servidor: lo que se ve antes de guardar es lo que va a quedar.
  const filasNum = filas
    .map((f) => ({ anio: Number(f.anio), dias: Number(f.dias) || 0 }))
    .filter((f) => Number.isInteger(f.anio) && f.anio > 0);
  // Años que quedarían con más días imputados que otorgados. El servidor aplica
  // la misma regla: acá sólo se adelanta el freno para que no haya que apretar
  // Guardar para enterarse.
  const aniosNegativos = filasNum.filter(
    (f) => f.dias < (saldo.anios.find((a) => a.anio === f.anio)?.usados ?? 0),
  );
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
  const diasAntig = anios != null ? diasPorAntiguedad(anios) : resumen.corresponden;
  // Días ya tomados CONTRA el año en curso (no "los que arrancaron este año"):
  // es lo que hace falta para leer la tarjeta de Corresponden sin confundirse.
  const usadosY = saldosVista.find((a) => a.anio === finPeriodoY)?.usados ?? 0;
  // Años en los que hay MENOS días cargados de los que marca la ley. No es lo
  // mismo que el viejo "desfasaje", que mezclaba esto con los que tienen días de
  // más por arrastre y sólo miraba el año en curso.
  const faltantes = chequeoLey(saldosVista, fecha_ingreso ?? null, finPeriodoY);

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

  // Días que le corresponden por ley EN ESE AÑO. La antigüedad se mide al 31/12
  // del año de la fila: proponer siempre los días del año en curso hacía que
  // agregar el 2024 sugiriera los días del 2026.
  const diasLeyDe = (anio: number) =>
    fecha_ingreso && Number.isInteger(anio) ? diasPorAntiguedadEnAnio(fecha_ingreso, anio) : diasAntig;

  const abrirEdicion = () => {
    setFilas(
      (saldo.anios.length > 0
        ? saldo.anios
        : [
            {
              anio: finPeriodoY,
              otorgados: diasLeyDe(finPeriodoY),
              usados: 0,
              saldo: 0,
              observaciones: null,
            },
          ]
      ).map((a) => ({
        anio: String(a.anio),
        dias: String(a.otorgados),
        observaciones: a.observaciones ?? "",
      })),
    );
    setError(null);
    setEditando(true);
  };

  // Pone en una fila del editor los días que marca la ley para ese año. Abre el
  // editor si estaba cerrado: es el atajo de los avisos "le faltan N días".
  const ponerDiasDeLey = (anio: number, dias: number) => {
    setError(null);
    if (!editando) {
      setFilas(
        (saldo.anios.length > 0 ? saldo.anios : [{ anio, otorgados: dias, observaciones: null }]).map(
          (a) => ({
            anio: String(a.anio),
            dias: String(a.anio === anio ? dias : a.otorgados),
            observaciones: a.observaciones ?? "",
          }),
        ),
      );
      setEditando(true);
      return;
    }
    setFilas((p) =>
      p.some((x) => Number(x.anio) === anio)
        ? p.map((x) => (Number(x.anio) === anio ? { ...x, dias: String(dias) } : x))
        : [...p, { anio: String(anio), dias: String(dias), observaciones: "" }],
    );
  };

  const verHistorial = async (anio: number) => {
    if (historialAnio === anio) {
      setHistorialAnio(null);
      return;
    }
    setHistorialAnio(anio);
    if (historial[anio] !== undefined) return;
    setHistorial((p) => ({ ...p, [anio]: "cargando" }));
    const movs = await historialAnioAction(chofer_id, anio);
    setHistorial((p) => ({ ...p, [anio]: movs }));
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

      {/* Dos tarjetas y no cuatro (pedido de Bárbara, 29/07/2026). "Tomados" y
          "Disponibles" se fueron: el primero no participa de ninguna cuenta de
          esta pantalla, y el segundo suma días del año en curso —que recién se
          pueden autorizar desde octubre— con días exigibles del año pasado, que
          es justo lo que la confundía ("los 21 de 2026 son arena de otro
          costal"). Lo que decían los tooltips pasó a la sublínea, visible. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SaldoCard
          label={`Corresponden ${finPeriodoY}`}
          value={resumen.corresponden}
          tone="muted"
          sub={
            usadosY === 0
              ? `Se toman desde el 01/10/${finPeriodoY}. Todavía no se tomó ninguno.`
              : `Se toman desde el 01/10/${finPeriodoY}. Ya se tomó ${usadosY}.`
          }
        />
        <SaldoCard
          label={`Adeudados ${finPeriodoY - 1}`}
          // Un negativo no es un saldo: es una inconsistencia de datos. Mostrarlo
          // como cantidad ("−15") fue lo que la desorientó. Se muestra 0 y el
          // sobregiro se explica en una línea aparte, abajo.
          value={Math.max(0, resumen.adeudados)}
          tone="muted"
          sub={
            resumen.adeudados > 0
              ? `Vencen el 31/12/${finPeriodoY}.`
              : resumen.adeudados === 0
                ? `No le queda nada del ${finPeriodoY - 1}.`
                : undefined
          }
        />
      </div>
      {resumen.adeudados < 0 && (
        <p className="border-l-2 border-[#991B1B]/40 pl-3 text-[13px] leading-snug text-[#991B1B]">
          Hay {Math.abs(resumen.adeudados)} días imputados al {finPeriodoY - 1} de más de los que le
          correspondían. Revisá los días del {finPeriodoY - 1} acá abajo, o de qué año descuentan los
          períodos.
        </p>
      )}
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

      {/* La antigüedad, escrita. Antes eran cinco chips ("Hito ★ ≥5 años",
          "Próximo hito 64 meses → 10 años") que decían el mismo dato en un
          formato que hay que descifrar. Y respondiendo la pregunta que hizo
          Bárbara —si los días se actualizan solos cada 1 de enero—, que hasta
          ahora había que preguntarla porque no estaba escrita en ningún lado. */}
      <div className="rounded-[8px] border border-border bg-muted/20 px-4 py-3 space-y-2">
        <p className="text-[13px] leading-snug text-muted-foreground">
          {explicarAntiguedad(fecha_ingreso ?? null, finPeriodoY)}
        </p>
        {can_write &&
          faltantes.map((f) => (
            <p key={f.anio} className="border-l-2 border-[#B45309]/40 pl-3 text-[13px] leading-snug">
              Tiene {f.otorgados} días cargados para el {f.anio} y por su antigüedad le corresponden{" "}
              {f.ley}.{" "}
              <button
                type="button"
                onClick={() => ponerDiasDeLey(f.anio, f.ley)}
                className="text-primary hover:underline"
              >
                Poner {f.ley}
              </button>
            </p>
          ))}
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
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={guardar}
                    disabled={saving || aniosNegativos.length > 0}
                    className="h-7 text-xs"
                  >
                    <Save size={13} className="mr-1" />
                    {saving ? "Guardando…" : "Guardar"}
                  </Button>
                  {aniosNegativos.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Revisá el {aniosNegativos.map((f) => f.anio).join(", ")} antes de guardar.
                    </span>
                  )}
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
            {/* Encabezados reales, una sola vez y alineados con los inputs. El
                error de Bárbara (poner 3 donde va 21) salió de que al lado del
                input había una columna que decía "sin tomar" y la leyó como el
                rótulo del campo. Un input debajo de un encabezado no se puede
                confundir con la columna de al lado. */}
            <div className="grid grid-cols-[5rem_9rem_6rem_6rem_1fr_auto] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Año</span>
              <span>Días que le corresponden</span>
              <span className="text-center">Ya se tomó</span>
              <span className="text-center">Queda</span>
              <span>Por qué (opcional)</span>
              <span className="w-4" />
            </div>
            {filas.map((f, i) => {
              const anioNum = Number(f.anio);
              const usados = saldo.anios.find((a) => a.anio === anioNum)?.usados ?? 0;
              const queda = (Number(f.dias) || 0) - usados;
              return (
                <div key={i}>
                  <div
                    className={`grid grid-cols-[5rem_9rem_6rem_6rem_1fr_auto] items-center gap-2 ${
                      queda < 0 ? "rounded-[4px] border border-[#991B1B]/40 p-1.5 -m-1.5" : ""
                    }`}
                  >
                    <Input
                      type="number"
                      value={f.anio}
                      onChange={(e) =>
                        setFilas((p) => p.map((x, j) => (j === i ? { ...x, anio: e.target.value } : x)))
                      }
                      className="font-mono"
                      aria-label="Año"
                    />
                    <div className="flex items-center gap-1.5">
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
                      {fecha_ingreso && Number.isInteger(anioNum) && (
                        <button
                          type="button"
                          onClick={() =>
                            setFilas((p) =>
                              p.map((x, j) => (j === i ? { ...x, dias: String(diasLeyDe(anioNum)) } : x)),
                            )
                          }
                          title={`Poner los ${diasLeyDe(anioNum)} días que le corresponden por antigüedad al 31/12/${anioNum}`}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                    {/* Dato, no campo: sin borde de input y siempre con número
                        (nunca un texto que se pueda leer como rótulo). */}
                    <span className="text-center text-sm tabular-nums text-muted-foreground">{usados}</span>
                    <span
                      className={`text-center text-sm tabular-nums ${
                        queda < 0 ? "text-[#991B1B]" : "text-muted-foreground"
                      }`}
                    >
                      {queda}
                    </span>
                    <Input
                      value={f.observaciones}
                      onChange={(e) =>
                        setFilas((p) => p.map((x, j) => (j === i ? { ...x, observaciones: e.target.value } : x)))
                      }
                      placeholder="Ej.: arrastre acordado con el chofer"
                      className="min-w-0"
                      aria-label="Por qué"
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
                  {queda < 0 && (
                    <p className="mt-2 border-l-2 border-[#991B1B]/40 pl-3 text-[13px] leading-snug text-[#991B1B]">
                      El {f.anio} quedaría en {queda}: le estás dando {Number(f.dias) || 0} días y ya tiene{" "}
                      {usados} imputados a ese año. Acá va el TOTAL del año, no lo que le queda. Si le quedan
                      3 sin tomar y ya se tomó 18, el número de esta columna es 21.
                    </p>
                  )}
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
                  // Los días del año SUGERIDO, no los del año en curso: agregar
                  // el 2024 proponía los días del 2026 si en el medio cruzó un
                  // escalón de antigüedad.
                  return [...p, { anio: String(sugerido), dias: String(diasLeyDe(sugerido)), observaciones: "" }];
                })
              }
              className="h-7 text-xs text-muted-foreground border-border"
            >
              <Plus size={12} className="mr-1" /> Agregar año
            </Button>
            <p className="text-xs text-muted-foreground pt-1">
              «Días que le corresponden» es el total del año, no lo que le queda. «Ya se tomó» y «Queda» los
              calcula el sistema con las vacaciones cargadas abajo y no se editan.
            </p>
          </div>
        ) : saldosVista.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Sin días cargados todavía.</p>
        ) : (
          /* Mismas cabeceras que el editor, a propósito: lo que se ve leyendo es
             idéntico a lo que se ve editando, así que no puede haber un
             malentendido de columnas entre los dos modos — que es exactamente
             cómo se produjo el error. */
          <div className="px-4 py-3">
            <div className="rounded-[4px] border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2.5 py-1.5 text-left font-normal">Año</th>
                    <th className="px-2.5 py-1.5 text-right font-normal">Corresponden</th>
                    <th className="px-2.5 py-1.5 text-right font-normal">Tomó</th>
                    <th className="px-2.5 py-1.5 text-right font-normal">Queda</th>
                    <th className="px-2.5 py-1.5 text-left font-normal">De dónde salió</th>
                    <th className="px-2.5 py-1.5 text-right font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {saldosVista.map((a) => {
                    const vencido = a.anio < finPeriodoY - 1;
                    const movs = historial[a.anio];
                    return (
                      <Fragment key={a.anio}>
                        <tr
                          className={`border-b border-border last:border-b-0 ${
                            vencido ? "text-muted-foreground/60" : "text-foreground"
                          }`}
                          title={a.observaciones ?? undefined}
                        >
                          <td className="px-2.5 py-1.5 tabular-nums">{a.anio}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{a.otorgados}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">{a.usados}</td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums">
                            {vencido ? "vencido" : a.saldo}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <OrigenDato origen={a.origen} />
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => verHistorial(a.anio)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              {historialAnio === a.anio ? "Ocultar historial" : "Ver historial"}
                            </button>
                          </td>
                        </tr>
                        {historialAnio === a.anio && (
                          <tr className="border-b border-border last:border-b-0">
                            <td colSpan={6} className="px-2.5 py-2 text-xs text-muted-foreground">
                              {movs === "cargando" || movs === undefined ? (
                                "Buscando movimientos…"
                              ) : movs.length === 0 ? (
                                "No hay movimientos registrados de este año."
                              ) : (
                                <ul className="space-y-0.5">
                                  {movs.map((m, i) => (
                                    <li key={i} className="tabular-nums">
                                      {m.dias_antes ?? "—"} → {m.dias_despues ?? "—"} ·{" "}
                                      {formatFecha(m.fecha)} ·{" "}
                                      {m.usuario_nombre ?? "sin usuario (escritura directa a la base)"}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                      <span className="text-xs text-muted-foreground">
                        · {a.dias} día{a.dias !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {a.en_curso && editandoFechas !== a.id && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
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
                  <OrigenDato origen={a.origen} />
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
  sub,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "error";
  hint?: string;
  /** Aclaración debajo del número. Va chica a propósito: explica, no compite. */
  sub?: string;
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
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

/**
 * De dónde salió un dato. Es lo que permite distinguir a simple vista un número
 * que cargó una persona (y que ningún proceso automático puede pisar) de uno que
 * puso el sistema. Sin dato se dice "sin registrar": atribuirle a la máquina
 * algo que quizás cargó alguien sería volver al problema por otra puerta.
 */
function OrigenDato({ origen }: { origen?: OrigenDias }) {
  const mapa: Record<string, { dot: string; texto: string }> = {
    humano: { dot: "bg-primary", texto: "Lo cargó una persona" },
    planilla: { dot: "bg-muted-foreground/40", texto: "Vino de la planilla" },
    antiguedad: { dot: "bg-muted-foreground/40", texto: "Lo puso el sistema por antigüedad" },
    conciliacion: {
      dot: "bg-[#B45309]",
      texto: "Conciliación del 21/07/2026 · sin usuario registrado",
    },
  };
  const m = mapa[origen ?? ""] ?? { dot: "bg-muted-foreground/30", texto: "Sin registrar" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.texto}
    </span>
  );
}
