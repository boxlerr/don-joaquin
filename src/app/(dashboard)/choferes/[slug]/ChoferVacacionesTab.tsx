"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Palmtree, Plus, Save, Trash2, Pencil, X, ChevronRight } from "lucide-react";
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
  fmtRangoCorto,
  fmtRangoFechas,
  fmtDiaLargo,
  diaSiguiente,
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

  // Qué grupos de año quedaron abiertos o cerrados a mano.
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});

  // Períodos de vacaciones ya tomados (ausencias marcadas como vacaciones).
  const periodos = ausencias.filter((a) => a.es_vacaciones);

  // Períodos agrupados por el año del que descuentan, del más nuevo al más viejo.
  // Los que no descuentan de ningún año (histórico) van al final, porque son los
  // que menos se consultan.
  const gruposPeriodos = (() => {
    const porAnio = new Map<string, typeof periodos>();
    for (const p of periodos) {
      const clave = p.anio_cargo != null ? String(p.anio_cargo) : "hist";
      const lista = porAnio.get(clave) ?? [];
      lista.push(p);
      porAnio.set(clave, lista);
    }
    return [...porAnio.entries()]
      .sort(([a], [b]) => {
        if (a === "hist") return 1;
        if (b === "hist") return -1;
        return Number(b) - Number(a);
      })
      .map(([clave, items]) => ({
        clave,
        titulo: clave === "hist" ? "No descuentan de ningún año" : `Del saldo ${clave}`,
        items: [...items].sort((x, y) => (x.fecha_inicio < y.fecha_inicio ? 1 : -1)),
        dias: items.reduce((acc, p) => acc + p.dias, 0),
        // Sólo el año en curso y el anterior arrancan abiertos: son los que se
        // están liquidando. Lo viejo se pide cuando se necesita.
        abiertoPorDefecto: clave !== "hist" && Number(clave) >= finPeriodoY - 1,
      }));
  })();

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

  // Los años ya vencidos no se listan. Las vacaciones duran dos años: las de
  // 2024 se gozan hasta el 31/12/2025 y después se pierden, así que su renglón
  // sólo dice "0 de 14" y ensucia. Si quedaron días sin gozar, el aviso de
  // arriba los sigue nombrando. Los períodos tomados NO se tocan: siguen
  // apareciendo en "Vacaciones cargadas", que es el historial.
  const aniosVigentes = saldosVista.filter((a) => a.anio >= finPeriodoY - 1);

  // El año anterior quedó con más días imputados que cargados. Es un error de
  // carga, no un saldo, así que se avisa aparte en vez de mostrarlo en negativo.
  const anioAnterior = saldosVista.find((a) => a.anio === finPeriodoY - 1);
  const sobregiro =
    anioAnterior && anioAnterior.saldo < 0
      ? { usados: anioAnterior.usados, otorgados: anioAnterior.otorgados }
      : null;

  // Explica de dónde sale el saldo, año por año. Sin esto, ver "Corresponden 14"
  // al lado de un saldo menor parece un error del sistema.
  const cuentaSaldo = (() => {
    const vigentes = saldosVista.filter((a) => a.anio >= finPeriodoY - 1 && a.anio <= finPeriodoY);
    if (vigentes.length === 0) return null;
    const partes = vigentes.map((a) =>
      a.usados > 0
        ? // Un saldo negativo no se escribe como saldo ("quedan −15" no se
          // entiende): se dice que se pasó, que es lo que realmente pasó.
          a.saldo < 0
          ? `del ${a.anio} le tocaban ${a.otorgados} y ya se tomó ${a.usados}, se pasó por ${-a.saldo}`
          : `del ${a.anio} le tocaban ${a.otorgados} y ya se tomó ${a.usados}, quedan ${a.saldo}`
        : `del ${a.anio} le tocan ${a.otorgados} y no se tomó ninguno`,
    );
    const total = vigentes.reduce((s, a) => s + a.saldo, 0);
    if (vigentes.length === 1) return `${partes[0]!.charAt(0).toUpperCase()}${partes[0]!.slice(1)}.`;
    return total > 0
      ? `${partes.join("; ")}. En total le quedan ${total} día${total === 1 ? "" : "s"}.`
      : `${partes.join("; ")}. En total no le queda ninguno.`;
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
            className="h-10 border-[#CBD5E1] px-4 text-sm text-foreground/90 hover:bg-muted/40"
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={15} className="mr-2 text-primary" />
            Cargar vacaciones
          </Button>
        )}
      </div>

      {/* Dos números y nada más, como los pidió Bárbara (29/07/2026): "yo dejaría
          cuántos le corresponden de 2026, cuántos le debo de 2025, y nada más;
          tomados me confunde y disponibles también es medio confuso". */}
      {/* Acotadas: con dos tarjetas a todo el ancho quedaban dos cajas enormes
          con un número perdido adentro. */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <SaldoCard
          label={`Corresponden (${finPeriodoY})`}
          value={resumen.corresponden}
          tone="muted"
          hint={`Los días que le tocan por ${finPeriodoY} según su antigüedad. Es el total del año, no lo que le queda.`}
        />
        <SaldoCard
          label={`Adeudados (${finPeriodoY - 1})`}
          value={Math.max(0, resumen.adeudados)}
          tone="muted"
          hint={`Lo que le quedó sin tomar del ${finPeriodoY - 1}.`}
        />
      </div>
      {/* Un adeudados negativo no es un saldo: es que a ese año se le imputaron
          más días de los que tiene cargados. La tarjeta muestra 0 y el problema
          se explica acá, porque un "−15" pelado fue justo lo que asustó a
          Bárbara sin decirle qué hacer. */}
      {sobregiro && (
        <p className="border-l-2 border-[#EF4444] pl-3 text-[13px] leading-snug text-foreground">
          <span className="font-medium">Falta corregir el {finPeriodoY - 1}.</span> Se le imputaron{" "}
          {sobregiro.usados} días y tiene {sobregiro.otorgados} cargados. Editá los días de ese año.
        </p>
      )}
      {/* La cuenta escrita. "Corresponden 14" al lado de un saldo menor se lee
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
          {/* Sin subtítulo con la fórmula: los encabezados de la tabla ya dicen
              qué es cada número, y era texto de más. */}
          <h4 className="text-sm font-semibold text-foreground">Días por año</h4>
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
        ) : aniosVigentes.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Sin días cargados todavía.</p>
        ) : (
          /* Ni chips en monoespaciada ("2025: 0 de 28 (usados 28)") ni una tabla
             de tres columnas: en los dos casos hay que leer números y compararlos
             de memoria. Con una barra se VE cuánto le queda, y el color dice si
             corre riesgo de vencer. Mismo lenguaje que la vista global. */
          <div className="divide-y divide-border">
            {aniosVigentes.map((a) => {
              // El saldo del año anterior vence el 31/12 de este año: es el que
              // hay que gastar primero, así que va en rojo.
              const porVencer = a.anio === finPeriodoY - 1;
              const queda = Math.max(0, a.saldo);
              const color = porVencer ? "#B91C1C" : "#059669";
              // La barra se llena SÓLO con lo que le queda. Antes pintaba también
              // los días tomados en gris y un año agotado quedaba con la barra
              // entera: visualmente "lleno" cuando significaba lo contrario.
              const pct = a.otorgados > 0 ? Math.min(100, (queda / a.otorgados) * 100) : 0;
              return (
                <div key={a.anio} className="px-4 py-3.5" title={a.observaciones ?? undefined}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-baseline gap-2">
                      <span className="text-base font-semibold tabular-nums text-foreground">{a.anio}</span>
                      {porVencer && queda > 0 && (
                        <span className="text-[11px] text-[#B91C1C]">vence el 31/12/{finPeriodoY}</span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-1.5 tabular-nums">
                      <span
                        className={`text-2xl font-semibold leading-none ${
                          queda === 0 ? "text-muted-foreground" : porVencer ? "text-[#B91C1C]" : "text-[#059669]"
                        }`}
                      >
                        {queda}
                      </span>
                      <span className="text-xs text-muted-foreground">de {a.otorgados}</span>
                    </span>
                  </div>
                  <div
                    className="mt-2.5 h-2 w-full overflow-hidden rounded-[3px] bg-muted"
                    title={
                      queda > 0
                        ? `Le quedan ${queda} de ${a.otorgados}`
                        : `No le queda ninguno de los ${a.otorgados}`
                    }
                  >
                    <div
                      className="h-full rounded-[3px]"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vacaciones cargadas, agrupadas por el año del que descuentan.
          Antes era una lista plana de tarjetas con borde: con tres períodos se
          leía, pero un legajo de diez años junta doscientos y se vuelve un muro.
          Agrupar por año hace dos cosas: da unidades de ~20 filas en vez de una
          de 200, y deja auditar el bloque "Días por año" de arriba —el subtotal
          de cada grupo tiene que ser lo que ahí figura como tomado. Los años que
          no son el actual ni el anterior arrancan plegados. */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">
          Vacaciones cargadas
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {periodos.length} período{periodos.length !== 1 ? "s" : ""}
          </span>
        </h4>
        {periodos.length === 0 ? (
          <EmptyState icon={Palmtree} message="Sin vacaciones cargadas" />
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-border bg-card">
            {gruposPeriodos.map((g) => {
              const abierto = plegados[g.clave] ?? g.abiertoPorDefecto;
              return (
                <section key={g.clave}>
                  <button
                    type="button"
                    onClick={() =>
                      setPlegados((p) => ({ ...p, [g.clave]: !(p[g.clave] ?? g.abiertoPorDefecto) }))
                    }
                    className="flex w-full items-baseline gap-2 border-b border-border bg-muted/60 px-3.5 py-2 text-left hover:bg-muted"
                  >
                    <ChevronRight
                      size={13}
                      className={`shrink-0 self-center text-muted-foreground transition-transform ${abierto ? "rotate-90" : ""}`}
                      aria-hidden
                    />
                    <span className="text-[13px] font-semibold text-foreground">{g.titulo}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {g.items.length} período{g.items.length !== 1 ? "s" : ""} ·{" "}
                      {g.dias} día{g.dias !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {abierto && (
                    <ul className="divide-y divide-border">
                      {g.items.map((a) => (
                        <li key={a.id} className="group px-3.5 py-2.5">
                          {editandoFechas === a.id ? (
                            <span className="flex flex-wrap items-center gap-1.5">
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
                              <span className="text-xs tabular-nums text-muted-foreground">
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
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {/* La fecha manda y va en columna de ancho fijo: así
                                  la lista se escanea hacia abajo en vez de leerse
                                  renglón por renglón. */}
                              <button
                                type="button"
                                disabled={!can_write}
                                onClick={() => can_write && abrirFechas(a)}
                                title={can_write ? "Corregir las fechas" : undefined}
                                className={`w-[12.5rem] shrink-0 text-left text-sm font-semibold tabular-nums text-foreground ${
                                  can_write ? "cursor-pointer hover:text-primary hover:underline" : "cursor-default"
                                }`}
                              >
                                {fmtRangoCorto(a.fecha_inicio, a.fecha_fin)}
                              </button>
                              <span className="w-[4.5rem] shrink-0 text-sm tabular-nums text-muted-foreground">
                                <span className="font-semibold text-foreground">{a.dias}</span> día
                                {a.dias !== 1 ? "s" : ""}
                              </span>
                              <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                                {a.en_curso && (
                                  <span className="inline-flex items-center gap-1.5 font-medium text-[#059669]">
                                    <span className="inline-block size-1.5 rounded-full bg-[#10B981]" aria-hidden />
                                    Está de vacaciones · vuelve el{" "}
                                    <span className="font-medium text-foreground">
                                      {fmtDiaLargo(diaSiguiente(a.fecha_fin), `${finPeriodoY}-01-01`)}
                                    </span>
                                  </span>
                                )}
                                {!a.en_curso && a.autorizado_por_nombre && (
                                  <span>autorizó {a.autorizado_por_nombre}</span>
                                )}
                              </span>
                              {reimputando === a.id ? (
                                <span className="inline-flex shrink-0 items-center gap-1">
                                  <Select
                                    value={a.anio_cargo != null ? String(a.anio_cargo) : "hist"}
                                    onValueChange={(v) => v && cambiarImputacion(a.id, v)}
                                  >
                                    <SelectTrigger className="h-7 w-[12rem] text-xs">
                                      <span>
                                        {a.anio_cargo != null
                                          ? `Descuenta del ${a.anio_cargo}`
                                          : "Histórico (no descuenta)"}
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {aniosDisponibles.map((y) => {
                                        // Cuánto queda en ese año SI se mueve el
                                        // período para allá: se le devuelven los
                                        // días al año que lo tiene hoy.
                                        const fila = saldo.anios.find((x) => x.anio === y);
                                        const propio = a.anio_cargo === y;
                                        const queda = fila ? fila.saldo : null;
                                        return (
                                          <SelectItem key={y} value={String(y)}>
                                            Descuenta del {y}
                                            {queda != null && (
                                              <span className="text-muted-foreground">
                                                {" · "}
                                                {propio
                                                  ? `hoy sale de acá, quedan ${Math.max(0, queda)}`
                                                  : queda - a.dias < 0
                                                    ? `no le alcanza: quedan ${Math.max(0, queda)} de ${fila!.otorgados}`
                                                    : `le quedan ${queda} de ${fila!.otorgados}`}
                                              </span>
                                            )}
                                          </SelectItem>
                                        );
                                      })}
                                      <SelectItem value="hist">
                                        Histórico
                                        <span className="text-muted-foreground">
                                          {" · "}no toca ningún saldo
                                        </span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
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
                                can_write && (
                                  <span className="flex shrink-0 items-center gap-2.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => setReimputando(a.id)}
                                      title="Cambiar de qué año descuenta este período"
                                      className="text-[13px] text-muted-foreground hover:text-primary"
                                    >
                                      cambiar año
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCancelando(a)}
                                      title="Cancelar este período (los días vuelven al saldo)"
                                      className="text-muted-foreground hover:text-[#EF4444]"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Clic en las <span className="font-medium">fechas</span> para corregirlas. Cada grupo suma lo
          que se tomó de ese año, así se puede cotejar con <span className="font-medium">Días por año</span>.
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
    // Centrada y con el rótulo destacado: era un título en gris de 11px arriba de
    // un número pegado a la izquierda, y no se leía como una unidad.
    <div
      className="rounded-[8px] border border-border bg-muted/30 px-4 py-3 text-center"
      title={hint}
    >
      <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">{label}</div>
      <div className={`mt-1 text-[32px] font-bold leading-none tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        día{value !== 1 ? "s" : ""}
      </div>
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
