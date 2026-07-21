"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import ImprimirPlanillaButton from "./ImprimirPlanillaButton";
import CambiosDrawer from "./CambiosDrawer";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  History,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Repeat2,
} from "lucide-react";
import {
  guardarPlanillaDiariaAction,
  type PlanillaDiariaData,
} from "./actions";

type Fila = {
  chofer_id: string;
  nombre: string;
  apellido: string;
  camion_habitual_id: string | null;
  camion_habitual_patente: string | null;
  /** "" = sin asignar */
  camion_id: string;
  /** Camión que tenía antes de esta planilla. "" = ninguno. */
  camion_previo_id: string;
  camion_previo_patente: string | null;
  observaciones: string;
};

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
}

function buildFilas(data: PlanillaDiariaData): Fila[] {
  return data.choferes.map((c) => ({
    chofer_id: c.chofer_id,
    nombre: c.nombre,
    apellido: c.apellido,
    camion_habitual_id: c.camion_habitual_id,
    camion_habitual_patente: c.camion_habitual_patente,
    // El server ya resuelve el valor por defecto (asignación fija hoy · snapshot en historial).
    camion_id: c.camion_asignado_id ?? "",
    camion_previo_id: c.camion_previo_id ?? "",
    camion_previo_patente: c.camion_previo_patente,
    observaciones: c.observaciones ?? "",
  }));
}

/** "AD916TF → AE331SH": de qué unidad a cuál pasó el chofer. */
function CambioCamion({ antes, ahora }: { antes: string | null; ahora: string | null }) {
  return (
    <span
      title={`Cambió de ${antes ?? "sin camión"} a ${ahora ?? "sin camión"}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold"
    >
      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        {antes ?? "Sin camión"}
      </span>
      <ArrowRight size={11} className="text-muted-foreground/70 shrink-0" />
      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        {ahora ?? "Sin camión"}
      </span>
    </span>
  );
}

export default function PlanillaDiariaClient({ data }: { data: PlanillaDiariaData }) {
  const router = useRouter();
  const editable = data.editable;
  const [filas, setFilas] = useState<Fila[]>(() => buildFilas(data));
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [cambiosOpen, setCambiosOpen] = useState(false);
  const [soloCambios, setSoloCambios] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(data.fecha + "T00:00:00"));

  const fechasGuardadas = useMemo(
    () => new Set(data.fechas_guardadas ?? []),
    [data.fechas_guardadas],
  );
  const fechasConCambios = useMemo(
    () => new Set(data.fechas_con_cambios ?? []),
    [data.fechas_con_cambios],
  );

  // Patente por id, para poder mostrar "de qué camión a cuál".
  const patentePorCamion = useMemo(
    () => new Map(data.camiones.map((c) => [c.id, c.label])),
    [data.camiones],
  );

  /** Una fila cambió si el camión que tiene ahora no es el que traía. */
  const tieneCambio = (f: Fila) => f.camion_id !== f.camion_previo_id;

  const filasConCambio = useMemo(() => filas.filter(tieneCambio), [filas]);
  const filasVisibles = soloCambios ? filasConCambio : filas;

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const startDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Padding anterior
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevDaysInMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      cells.push({
        dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Padding posterior
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({
        dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentMonth]);

  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Qué chofer(es) tienen cada camión hoy — para marcar ocupado/libre en el selector.
  const ocupadoPor = useMemo(() => {
    const m = new Map<string, { id: string; label: string }[]>();
    for (const f of filas) {
      if (!f.camion_id) continue;
      const arr = m.get(f.camion_id) ?? [];
      arr.push({ id: f.chofer_id, label: f.apellido });
      m.set(f.camion_id, arr);
    }
    return m;
  }, [filas]);

  // Opciones del selector de UNA fila: verde = libre · ámbar = ocupado por otro
  // chofer ese día (mostrando su apellido).
  const opcionesCamion = (f: Fila): ComboboxOption[] =>
    data.camiones.map((c) => {
      const otros = (ocupadoPor.get(c.id) ?? []).filter((o) => o.id !== f.chofer_id);
      return otros.length
        ? {
            id: c.id,
            label: c.label,
            tone: "busy" as const,
            note: otros.map((o) => o.label).join(", "),
          }
        : { id: c.id, label: c.label, tone: "free" as const };
    });

  // Detección de camión repetido en el mismo día.
  const camionesDuplicados = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const f of filas) {
      if (f.camion_id) cuenta.set(f.camion_id, (cuenta.get(f.camion_id) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [filas]);

  const hayDuplicados = camionesDuplicados.size > 0;
  const asignados = filas.filter((f) => f.camion_id).length;

  const setCamion = (choferId: string, camionId: string) =>
    setFilas((prev) =>
      prev.map((f) => (f.chofer_id === choferId ? { ...f, camion_id: camionId } : f)),
    );

  const setObs = (choferId: string, obs: string) =>
    setFilas((prev) =>
      prev.map((f) => (f.chofer_id === choferId ? { ...f, observaciones: obs } : f)),
    );

  const restaurarHabituales = () => {
    setFilas((prev) =>
      prev.map((f) => ({ ...f, camion_id: f.camion_habitual_id ?? "", observaciones: "" })),
    );
    setResultado(null);
  };

  const cambiarFecha = (nueva: string) => {
    if (nueva && nueva !== data.fecha) {
      router.push(`/viajes/planilla-diaria?fecha=${nueva}`);
    }
  };

  const irAHoy = () => router.push("/viajes/planilla-diaria");

  const handleGuardar = async () => {
    if (hayDuplicados) {
      setResultado({ ok: false, mensaje: "Hay un camión asignado a más de un chofer. Corregí antes de guardar." });
      return;
    }
    setGuardando(true);
    setResultado(null);

    const res = await guardarPlanillaDiariaAction({
      fecha: data.fecha,
      items: filas.map((f) => ({
        chofer_id: f.chofer_id,
        camion_id: f.camion_id || null,
        observaciones: f.observaciones.trim() || null,
      })),
    });

    setGuardando(false);

    if (res.ok) {
      setResultado({
        ok: true,
        mensaje:
          res.cambios > 0
            ? `Planilla guardada: ${res.cambios} cambio(s) de camión sobre ${res.guardadas} chofer(es). Queda fijo hasta que lo cambies y el cambio queda registrado en el historial.`
            : `Planilla guardada: ${res.guardadas} chofer(es) con camión, sin cambios de unidad.`,
      });
      router.refresh();
    } else {
      setResultado({ ok: false, mensaje: res.error });
    }
  };

  return (
    <div className="space-y-5">
      <CambiosDrawer open={cambiosOpen} onClose={() => setCambiosOpen(false)} />

      {/* Barra superior: fecha + atajos */}
      <div className="bg-card border border-border rounded-[8px] px-5 py-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1 relative">
          <label className="text-xs font-semibold text-muted-foreground block">Fecha</label>
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className="h-9 px-3 text-sm rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] flex items-center gap-2 font-medium min-w-[130px] hover:bg-muted/30 transition-colors"
          >
            <CalendarClock size={15} className="text-[#0088D1]" />
            {fmtFecha(data.fecha)}
          </button>

          {pickerOpen && (
            <>
              {/* Backdrop para cerrar al hacer clic afuera */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setPickerOpen(false)} 
              />
              
              <div className="absolute top-[62px] left-0 z-50 bg-card border border-border shadow-lg rounded-[8px] p-4 w-[280px]">
                {/* Cabecera */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-foreground">
                    {MESES[currentMonth.getMonth()]} de {currentMonth.getFullYear()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Días de la semana */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
                  {["DO", "LU", "MA", "MI", "JU", "VI", "SA"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Grilla de días */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    const isSelected = cell.dateStr === data.fecha;
                    const isToday = cell.dateStr === data.hoy;
                    const guardada = fechasGuardadas.has(cell.dateStr);
                    const conCambios = fechasConCambios.has(cell.dateStr);
                    const isFuture = cell.dateStr > data.hoy;

                    let btnClass = "h-8 w-8 text-xs rounded-full flex items-center justify-center transition-colors relative ";
                    if (!cell.isCurrentMonth) {
                      btnClass += "text-muted-foreground/30 ";
                    } else if (isFuture) {
                      btnClass += "text-muted-foreground/30 cursor-not-allowed ";
                    } else {
                      btnClass += "text-foreground hover:bg-muted/60 ";
                    }

                    if (isSelected) {
                      btnClass += "bg-[#0088D1] text-white hover:bg-[#0088D1] font-bold ";
                    } else if (conCambios && cell.isCurrentMonth && !isFuture) {
                      btnClass += "bg-amber-50 text-amber-700 hover:bg-amber-100/80 font-semibold border border-amber-300/70 ";
                    } else if (guardada && cell.isCurrentMonth && !isFuture) {
                      btnClass += "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 font-semibold border border-emerald-200/60 ";
                    }

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isFuture}
                        onClick={() => {
                          cambiarFecha(cell.dateStr);
                          setPickerOpen(false);
                        }}
                        className={btnClass}
                        title={
                          conCambios
                            ? "Planilla guardada · hubo cambios de camión"
                            : guardada
                              ? "Planilla guardada"
                              : undefined
                        }
                      >
                        {cell.dayNum}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 size-1 bg-[#0088D1] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-border flex flex-col gap-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-50 border border-emerald-200/60" />
                    planilla guardada
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-amber-50 border border-amber-300/70" />
                    hubo cambio de camión
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restaurarHabituales}
              className="gap-1.5 h-9 text-xs"
            >
              <RotateCcw size={13} />
              Restaurar habituales
            </Button>
          )}
          <ImprimirPlanillaButton fecha={data.fecha} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCambiosOpen(true)}
            className="gap-1.5 h-9 text-xs"
            title="Ver todos los cambios de camión registrados"
          >
            <Repeat2 size={13} />
            Cambios de camión
          </Button>
        </div>

        <div className="self-center ml-auto flex items-center gap-3 text-xs text-muted-foreground/80">
          {(filasConCambio.length > 0 || soloCambios) && (
            <button
              type="button"
              onClick={() => setSoloCambios((v) => !v)}
              title={soloCambios ? "Ver todos los choferes" : "Ver solo los que cambiaron"}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                soloCambios
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              }`}
            >
              <Repeat2 size={12} />
              {filasConCambio.length} {filasConCambio.length === 1 ? "cambio" : "cambios"} de camión
            </button>
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> ocupado
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>{asignados} de {filas.length} choferes con camión</span>
        </div>
      </div>

      {/* Ese día nunca se guardó planilla: no hay nada que comparar */}
      {!editable && data.hay_planilla === false && (
        <div className="flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border bg-[#F8FAFC] border-border text-muted-foreground">
          <History size={16} className="shrink-0 mt-0.5 text-muted-foreground/60" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              No hay planilla registrada al {fmtFecha(data.fecha)}.
            </p>
            <p className="text-xs mt-0.5">
              Es anterior a la primera planilla guardada, así que no sabemos qué camión
              manejaba cada chofer ese día.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={irAHoy} className="gap-1.5 h-8 text-xs shrink-0">
            <CalendarClock size={13} /> Ir a hoy
          </Button>
        </div>
      )}

      {/* Aviso: fecha pasada = solo lectura (historial) */}
      {!editable && data.hay_planilla !== false && (
        <div className="flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border bg-[#F8FAFC] border-border text-muted-foreground">
          <History size={16} className="shrink-0 mt-0.5 text-[#0088D1]" />
          <div className="flex-1">
            <p className="font-medium text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>Estás viendo el historial del {fmtFecha(data.fecha)}.</span>
              {data.guardado_por && (
                <span className="text-xs font-normal text-muted-foreground">
                  (Guardado por <strong className="text-foreground">{data.guardado_por}</strong>
                  {data.guardado_el && ` el ${new Date(data.guardado_el).toLocaleDateString("es-AR")} a las ${new Date(data.guardado_el).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`})
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5">
              {data.vigente_desde ? (
                <>
                  Ese día no se cargó una planilla nueva: seguía vigente la del{" "}
                  <strong className="text-foreground">{fmtFecha(data.vigente_desde)}</strong>, con
                  las mismas unidades.
                </>
              ) : filasConCambio.length > 0 ? (
                <>
                  Ese día hubo{" "}
                  <strong className="text-amber-700">
                    {filasConCambio.length}{" "}
                    {filasConCambio.length === 1 ? "cambio" : "cambios"} de camión
                  </strong>
                  {data.fecha_anterior && (
                    <> respecto de la planilla del {fmtFecha(data.fecha_anterior)}</>
                  )}
                  . Se marcan en la columna <em>Cambio</em>.
                </>
              ) : (
                <>
                  Ese día se guardó la planilla sin cambios de camión
                  {data.fecha_anterior && (
                    <> respecto de la del {fmtFecha(data.fecha_anterior)}</>
                  )}
                  .
                </>
              )}{" "}
              Las asignaciones de días anteriores son solo lectura: para cambiar qué camión maneja
              cada chofer, volvé a la planilla de hoy.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={irAHoy} className="gap-1.5 h-8 text-xs shrink-0">
            <CalendarClock size={13} /> Ir a hoy
          </Button>
        </div>
      )}

      {/* Grilla */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Camión del día", "Cambio", "Observaciones"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs border-b border-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasVisibles.map((f) => {
                const esHabitual = !!f.camion_id && f.camion_id === f.camion_habitual_id;
                const duplicado = !!f.camion_id && camionesDuplicados.has(f.camion_id);
                const cambio = tieneCambio(f);
                return (
                  <tr
                    key={f.chofer_id}
                    className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${
                      duplicado ? "bg-red-50/50" : cambio ? "bg-amber-50/40" : ""
                    }`}
                  >
                    {/* Chofer */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">
                        {f.apellido}, {f.nombre}
                      </span>
                    </td>

                    {/* Camión */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Combobox
                          value={f.camion_id}
                          onValueChange={(v) => setCamion(f.chofer_id, v)}
                          options={opcionesCamion(f)}
                          placeholder="— Sin asignar —"
                          searchPlaceholder="Buscar patente..."
                          clearable
                          disabled={!editable}
                          invalid={duplicado}
                          triggerClassName="h-8 w-48 text-xs"
                        />
                        {esHabitual && !duplicado && (
                          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                            habitual
                          </span>
                        )}
                        {!esHabitual && !duplicado && (
                          <div className="flex flex-col gap-0.5">
                            {f.camion_id ? (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                Reemplazo {f.camion_habitual_patente ? `(Habitual: ${f.camion_habitual_patente})` : ""}
                              </span>
                            ) : (
                              f.camion_habitual_patente && (
                                <span className="text-[10px] font-medium text-muted-foreground/60 italic">
                                  Habitual: {f.camion_habitual_patente}
                                </span>
                              )
                            )}
                          </div>
                        )}
                        {duplicado && (
                          <span title="Camión asignado a otro chofer">
                            <AlertTriangle size={14} className="text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cambio de unidad: de qué camión venía y a cuál pasó */}
                    <td className="px-3 py-1.5">
                      {cambio ? (
                        <CambioCamion
                          antes={
                            f.camion_previo_id
                              ? f.camion_previo_patente ??
                                patentePorCamion.get(f.camion_previo_id) ??
                                null
                              : null
                          }
                          ahora={f.camion_id ? patentePorCamion.get(f.camion_id) ?? null : null}
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Observaciones */}
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={f.observaciones}
                        onChange={(e) => setObs(f.chofer_id, e.target.value)}
                        placeholder="Opcional (ej: reemplaza a Pérez)"
                        maxLength={500}
                        disabled={!editable}
                        className="h-8 w-full min-w-[220px] px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              })}
              {filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {soloCambios
                      ? "No hubo cambios de camión."
                      : "No hay choferes activos."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback */}
      {resultado && (
        <div
          className={`flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border ${
            resultado.ok
              ? "bg-[#ECFDF5] border-[#6EE7B7] text-[#064E3B]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]"
          }`}
        >
          {resultado.ok ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#10B981]" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
          )}
          <span className="font-medium">{resultado.mensaje}</span>
        </div>
      )}

      {/* Guardar (Flotante) */}
      {editable && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || hayDuplicados}
            className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold px-6 h-11 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            {guardando ? (
              <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            ) : (
              <><CheckCircle2 size={15} /> Guardar planilla</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
