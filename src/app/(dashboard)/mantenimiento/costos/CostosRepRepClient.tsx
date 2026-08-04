"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  Plus, Trash2, Loader2, Wrench, Search, Pencil, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, ChevronRight, Columns3, X,
} from "lucide-react";
import MonthPicker from "@/components/ui/MonthPicker";
import AddCostoDialog from "./AddCostoDialog";
import ProveedorSheet from "./ProveedorSheet";
import ExportCostosButton from "./ExportCostosButton";
import CostosGrid from "./CostosGrid";
import CostosComparativo from "./CostosComparativo";
import {
  getCostosRepRepAction,
  getMesParaCargaAction,
  deleteCostoRepRepAction,
  eliminarCostosLoteAction,
  type CostoRepRep,
  type CostosResumenMes,
} from "./actions";
import { ars, mesCorto, mesLabel, porcentaje, rangoMeses, variacion } from "./formato";

/** Consultar, cargar y comparar son tres trabajos y quieren tres pantallas. */
type Vista = "ver" | "cargar" | "comparar";

type Campo = "proveedor" | "mes" | "neto" | "iva" | "facturado";
type Orden = { campo: Campo; dir: "asc" | "desc" };

const th = "font-semibold px-3 py-2 whitespace-nowrap";

/** Encabezado de columna que ordena la tabla y muestra por dónde está ordenada. */
function ThOrden({
  label,
  campo,
  orden,
  onOrdenar,
  alineacion = "right",
}: {
  label: string;
  campo: Campo;
  orden: Orden;
  onOrdenar: (c: Campo) => void;
  alineacion?: "left" | "right";
}) {
  const activo = orden.campo === campo;
  const Icono = orden.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`${alineacion === "left" ? "text-left" : "text-right"} ${th}`}>
      <button type="button" onClick={() => onOrdenar(campo)} className="py-1.5 -my-1.5 hover:text-foreground">
        {label}
        {activo && <Icono size={11} className="inline ml-1 text-primary" />}
      </button>
    </th>
  );
}

export default function CostosRepRepClient({
  mesInicial,
  mesActual,
  vistaInicial = "ver",
  busquedaInicial = "",
  rowsIniciales,
  resumen,
  proveedores,
  canWrite,
}: {
  mesInicial: string | null;
  /** Primer día del mes de hoy, calculado en el servidor ("2026-08-01"). */
  mesActual: string;
  vistaInicial?: Vista;
  busquedaInicial?: string;
  rowsIniciales: CostoRepRep[];
  resumen: CostosResumenMes[];
  proveedores: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mes, setMes] = useState<string | null>(mesInicial);
  const [rows, setRows] = useState<CostoRepRep[]>(rowsIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [orden, setOrden] = useState<Orden>({ campo: "facturado", dir: "desc" });
  const [desglose, setDesglose] = useState(false);
  const [proveedorAbierto, setProveedorAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState<CostoRepRep | null>(null);
  const [aBorrar, setABorrar] = useState<CostoRepRep | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [aviso, setAviso] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [carga, setCarga] = useState<{
    rows: CostoRepRep[];
    proveedoresPrevios: string[];
    mesPrevio: string | null;
  } | null>(null);
  const [todas, setTodas] = useState<CostoRepRep[] | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [borrandoLote, setBorrandoLote] = useState(false);
  const [confirmaLote, setConfirmaLote] = useState(false);

  /**
   * Espeja el estado en la URL sin navegar: con `router.push` el server component
   * se vuelve a ejecutar en cada cambio de mes y la planilla perdería el foco de
   * la celda que se está escribiendo.
   */
  const sincronizarUrl = useCallback(
    (cambios: { mes?: string | null; vista?: Vista; q?: string }) => {
      if (typeof window === "undefined") return;
      const p = new URLSearchParams(window.location.search);
      if ("mes" in cambios) {
        // "todos" es un valor real (ver el histórico), distinto de no elegir nada.
        if (cambios.mes === null) p.set("mes", "todos");
        else if (cambios.mes) p.set("mes", cambios.mes);
      }
      if (cambios.vista) {
        if (cambios.vista === "ver") p.delete("vista");
        else p.set("vista", cambios.vista);
      }
      if (cambios.q !== undefined) {
        if (cambios.q.trim()) p.set("q", cambios.q.trim());
        else p.delete("q");
      }
      const qs = p.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      );
    },
    [],
  );

  async function cambiarMes(nuevo: string | null) {
    setMes(nuevo);
    sincronizarUrl({ mes: nuevo });
    setLoading(true);
    setCarga(null);
    const data = await getCostosRepRepAction(nuevo);
    setRows(data);
    setLoading(false);
  }

  /** El comparativo necesita todos los meses, no sólo el que está elegido. */
  async function abrirComparativo() {
    setVista("comparar");
    sincronizarUrl({ vista: "comparar" });
    if (todas !== null) return;
    setLoading(true);
    setTodas(await getCostosRepRepAction(null));
    setLoading(false);
  }

  /** Abre la planilla de un mes, exista o no: un mes sin datos también se carga. */
  async function abrirCarga(mesISO: string) {
    setVista("cargar");
    setMes(mesISO);
    sincronizarUrl({ vista: "cargar", mes: mesISO });
    setLoading(true);
    setCarga(null);
    const data = await getMesParaCargaAction(mesISO);
    setCarga(data);
    setRows(data.rows);
    setLoading(false);
  }

  // Si se entra por un link con ?vista=…, los datos de esa vista se traen al
  // montar. Todos los setState pasan por el `.then`, nunca sincrónicos.
  useEffect(() => {
    if (vistaInicial === "cargar" && mesInicial) {
      void getMesParaCargaAction(mesInicial).then((d) => {
        setCarga(d);
        setRows(d.rows);
      });
    } else if (vistaInicial === "comparar") {
      void getCostosRepRepAction(null).then(setTodas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los totales del mes los recalcula el servidor: la planilla avisa cuando la
  // persona dejó de escribir, no en cada tecla.
  const refrescarTotales = useCallback(() => {
    router.refresh();
  }, [router]);

  // Al guardar saltamos al mes cargado (aunque sea nuevo) y refrescamos, así el
  // mes aparece al toque en la tira y en el resumen sin recargar a mano.
  function onCostoGuardado(mesYYYYMM: string) {
    setEditando(null);
    setAviso({ variant: "success", message: "Costo guardado" });
    void cambiarMes(`${mesYYYYMM}-01`);
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    setBorrando(true);
    const res = await deleteCostoRepRepAction(aBorrar.id);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== aBorrar.id));
      setAviso({ variant: "success", message: "Costo eliminado" });
      router.refresh(); // si el mes quedó vacío, desaparece de la tira
    } else {
      setAviso({ variant: "error", message: res.error ?? "No se pudo eliminar." });
    }
    setBorrando(false);
    setABorrar(null);
  }

  /* --- Tira de meses: es el selector y a la vez la evolución del gasto -----
     Va del primer mes cargado hasta HOY, sin saltearse los del medio: si sólo
     se dibujaran los meses con datos, el mes en curso no aparecería hasta que
     alguien lo cargue, y es justo el que hay que cargar. */
  const evolucion = useMemo(() => {
    const conDatos = new Map(resumen.map((r) => [r.mes, r]));
    const primero = resumen.length > 0 ? resumen[resumen.length - 1].mes : mesActual;
    const ultimo = resumen.length > 0 && resumen[0].mes > mesActual ? resumen[0].mes : mesActual;
    return rangoMeses(primero, ultimo).map(
      (mes) =>
        conDatos.get(mes) ?? {
          mes,
          proveedores: 0,
          neto_total: 0,
          facturado_total: 0,
          iva_total: 0,
        },
    );
  }, [resumen, mesActual]);
  const maxMes = Math.max(1, ...evolucion.map((r) => Math.abs(r.facturado_total)));
  const mesesConDatos = useMemo(() => new Set(resumen.map((r) => r.mes)), [resumen]);
  const faltaElActual = !mesesConDatos.has(mesActual);

  // Con la tira llegando hasta hoy, los meses viejos la desbordan: arranca
  // mostrando el mes actual, que es el que hay que cargar.
  useEffect(() => {
    document
      .getElementById("tira-mes-actual")
      ?.scrollIntoView({ block: "nearest", inline: "end" });
  }, [evolucion.length]);
  const resumenPorMes = useMemo(
    () => new Map(resumen.map((r) => [r.mes, r])),
    [resumen],
  );

  /* --- Resumen del período elegido ---------------------------------------- */
  const periodo = useMemo(() => {
    if (mes) {
      const r = resumenPorMes.get(mes);
      const idx = resumen.findIndex((x) => x.mes === mes);
      const previo = idx >= 0 ? resumen[idx + 1] : undefined; // resumen viene nuevo → viejo
      return {
        titulo: mesLabel(mes),
        facturado: r?.facturado_total ?? 0,
        neto: r?.neto_total ?? 0,
        proveedores: r?.proveedores ?? 0,
        previo,
      };
    }
    const facturado = resumen.reduce((a, r) => a + r.facturado_total, 0);
    const neto = resumen.reduce((a, r) => a + r.neto_total, 0);
    return {
      titulo: `Todos los meses (${resumen.length})`,
      facturado,
      neto,
      proveedores: new Set(rows.map((r) => r.proveedor)).size,
      previo: undefined as CostosResumenMes | undefined,
    };
  }, [mes, resumen, resumenPorMes, rows]);

  const varMes = variacion(periodo.facturado, periodo.previo?.facturado_total);

  /* --- Filtro + orden ------------------------------------------------------ */
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q ? rows.filter((r) => r.proveedor.toLowerCase().includes(q)) : rows;
    const signo = orden.dir === "asc" ? 1 : -1;
    const iva = (r: CostoRepRep) => Number(r.facturado_total) - Number(r.neto_total);
    return [...base].sort((a, b) => {
      switch (orden.campo) {
        case "proveedor":
          return signo * a.proveedor.localeCompare(b.proveedor, "es");
        case "mes":
          return signo * a.mes.localeCompare(b.mes);
        case "neto":
          return signo * (Number(a.neto_total) - Number(b.neto_total));
        case "iva":
          return signo * (iva(a) - iva(b));
        default:
          return signo * (Number(a.facturado_total) - Number(b.facturado_total));
      }
    });
  }, [rows, busqueda, orden]);

  const totales = useMemo(() => {
    const suma = (f: (r: CostoRepRep) => number) => filtradas.reduce((a, r) => a + f(r), 0);
    const neto = suma((r) => Number(r.neto_total));
    const facturado = suma((r) => Number(r.facturado_total));
    return {
      netoGrav: suma((r) => Number(r.neto_gravado)),
      factGrav: suma((r) => Number(r.facturado_gravado)),
      netoNg: suma((r) => Number(r.neto_ng)),
      factNg: suma((r) => Number(r.facturado_ng)),
      neto,
      facturado,
      iva: facturado - neto,
    };
  }, [filtradas]);

  // La participación se mide contra el total visible: con un filtro puesto, un
  // "38% del mes" calculado sobre el total del mes no cerraría con la columna.
  const baseParticipacion = Math.max(1, Math.abs(totales.facturado));

  function ordenarPor(campo: Campo) {
    setOrden((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === "desc" ? "asc" : "desc" }
        : { campo, dir: campo === "proveedor" ? "asc" : "desc" },
    );
  }

  const hayFiltro = busqueda.trim().length > 0;

  /* --- Selección múltiple: corregir un mes de a una son 30 confirmaciones --- */
  const todasSeleccionadas = filtradas.length > 0 && filtradas.every((r) => seleccion.has(r.id));

  function alternarUna(id: string) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  // Tilda sólo lo que se está viendo: con un filtro puesto, "todo" es lo filtrado.
  function alternarTodas() {
    setSeleccion((s) => {
      if (filtradas.every((r) => s.has(r.id))) {
        const n = new Set(s);
        for (const r of filtradas) n.delete(r.id);
        return n;
      }
      return new Set([...s, ...filtradas.map((r) => r.id)]);
    });
  }

  const seleccionadas = useMemo(
    () => rows.filter((r) => seleccion.has(r.id)),
    [rows, seleccion],
  );
  const totalSeleccionado = seleccionadas.reduce((a, r) => a + Number(r.facturado_total), 0);
  const mesesSeleccionados = [...new Set(seleccionadas.map((r) => r.mes))];

  async function confirmarBorradoLote() {
    setBorrandoLote(true);
    const ids = seleccionadas.map((r) => r.id);
    const res = await eliminarCostosLoteAction(ids);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => !seleccion.has(r.id)));
      setSeleccion(new Set());
      setAviso({
        variant: "success",
        message: `${res.borrados} ${res.borrados === 1 ? "costo eliminado" : "costos eliminados"}`,
      });
      router.refresh();
    } else {
      setAviso({ variant: "error", message: res.error ?? "No se pudieron eliminar." });
    }
    setBorrandoLote(false);
    setConfirmaLote(false);
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <InlineFeedback
          variant={aviso.variant}
          message={aviso.message}
          onDismiss={() => setAviso(null)}
        />
      )}

      {/* Período elegido + tira de meses. Van juntos: la tira es el selector, y
          el número grande de al lado es el mes que está seleccionado en ella. */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start gap-4 sm:gap-5">
        <div className="min-w-0 lg:flex-1">
          <p className="text-xs text-muted-foreground">{periodo.titulo}</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mt-1">
            {ars(periodo.facturado)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            facturado a {periodo.proveedores}{" "}
            {periodo.proveedores === 1 ? "proveedor" : "proveedores"}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-xs text-muted-foreground">
            <span>
              Importe neto <span className="font-mono text-foreground">{ars(periodo.neto)}</span>
            </span>
            <span>
              IVA{" "}
              <span className="font-mono text-foreground">
                {ars(periodo.facturado - periodo.neto)}
              </span>
            </span>
            {/* El mes en curso no se carga solo: si no está, se dice y se ofrece
                el atajo, en vez de que haya que descubrir el hueco en la tira. */}
            {faltaElActual && canWrite && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                {mesLabel(mesActual)} todavía sin cargar
                <button
                  type="button"
                  onClick={() => void abrirCarga(mesActual)}
                  className="text-primary hover:underline font-medium"
                >
                  Cargarlo
                </button>
              </span>
            )}
            {varMes !== null && periodo.previo && (
              <span
                className={`flex items-center gap-1 ${
                  varMes > 0 ? "text-[#EF4444]" : "text-[#10B981]"
                }`}
              >
                {varMes > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {porcentaje(Math.abs(varMes))} {varMes > 0 ? "más" : "menos"} que{" "}
                {mesLabel(periodo.previo.mes)}
              </span>
            )}
          </div>
        </div>

        {evolucion.length > 0 && (
          <div className="lg:max-w-[55%] min-w-0 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-5">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Facturado por mes
              </p>
              <Button
                size="sm"
                variant={mes === null ? "default" : "outline"}
                onClick={() => cambiarMes(null)}
              >
                Todos los meses
              </Button>
            </div>
            <HorizontalScrollHint fadeBg="from-card">
              <div className="flex items-end gap-1.5 pb-1">
                {evolucion.map((r) => {
                  const activo = mes === r.mes;
                  const vacio = !mesesConDatos.has(r.mes);
                  const esHoy = r.mes === mesActual;
                  const alto = Math.max(3, (Math.abs(r.facturado_total) / maxMes) * 48);
                  return (
                    <button
                      key={r.mes}
                      type="button"
                      // Un mes sin cargar no tiene nada que mirar: lleva derecho
                      // a la planilla para cargarlo.
                      onClick={() => (vacio ? void abrirCarga(r.mes) : cambiarMes(r.mes))}
                      title={
                        vacio
                          ? `${mesLabel(r.mes)} — sin cargar. Tocá para cargarlo.`
                          : `${mesLabel(r.mes)} — ${ars(r.facturado_total)} facturado · ${r.proveedores} proveedores`
                      }
                      id={esHoy ? "tira-mes-actual" : undefined}
                      className="group flex flex-col items-center gap-1.5 shrink-0 w-9"
                    >
                      <span className="flex h-12 w-full items-end">
                        {vacio ? (
                          // Hueco punteado: se ve que el mes existe y que está vacío,
                          // sin fingir una barra de $0.
                          <span className="h-3 w-full rounded-[3px] border border-dashed border-border group-hover:border-[#0088D1]/60" />
                        ) : (
                          <span
                            className={`w-full rounded-[3px] transition-colors ${
                              activo ? "bg-[#0088D1]" : "bg-muted group-hover:bg-[#0088D1]/40"
                            }`}
                            style={{ height: `${alto}px` }}
                          />
                        )}
                      </span>
                      <span
                        className={`text-[10px] leading-none whitespace-nowrap ${
                          activo
                            ? "font-semibold text-primary"
                            : esHoy
                              ? "font-semibold text-foreground"
                              : vacio
                                ? "text-muted-foreground/50"
                                : "text-muted-foreground"
                        }`}
                      >
                        {mesCorto(r.mes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </HorizontalScrollHint>
          </div>
        )}
      </div>

      {/* Consultar y cargar son dos trabajos distintos: mirar el mes cerrado y
          llenar el mes nuevo no se hacen con la misma pantalla. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(
            [
              ["ver", "Ver el mes"],
              ["cargar", "Cargar"],
              ["comparar", "Comparar"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v === "cargar")
                  void abrirCarga(
                    mes ?? mesInicial ?? `${new Date().toISOString().slice(0, 7)}-01`,
                  );
                else if (v === "comparar") void abrirComparativo();
                else { setVista("ver"); setCarga(null); sincronizarUrl({ vista: "ver" }); }
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                vista === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {vista === "cargar" && canWrite && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mes a cargar</span>
            <MonthPicker
              value={(mes ?? mesInicial ?? "").slice(0, 7)}
              onChange={(v) => void abrirCarga(`${v}-01`)}
            />
          </div>
        )}
      </div>

      {vista === "comparar" ? (
        loading || todas === null ? (
          <p className="text-xs text-muted-foreground p-6 flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <CostosComparativo
            rows={todas}
            onVerProveedor={setProveedorAbierto}
            onCargarMes={(m) => void abrirCarga(m)}
          />
        )
      ) : vista === "cargar" ? (
        loading || !carga ? (
          <p className="text-xs text-muted-foreground p-6 flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Cargando…
          </p>
        ) : (
          <CostosGrid
            key={mes ?? "sin-mes"}
            mes={mes ?? mesInicial ?? ""}
            rows={carga.rows}
            proveedoresPrevios={carga.proveedoresPrevios}
            mesPrevio={carga.mesPrevio}
            proveedoresConocidos={proveedores}
            canWrite={canWrite}
            onCambiaron={refrescarTotales}
          />
        )
      ) : (
      <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-[280px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); sincronizarUrl({ q: e.target.value }); }}
            placeholder="Buscar proveedor…"
            className="pl-8 pr-9 h-9"
            aria-label="Buscar proveedor"
          />
          {hayFiltro && (
            <button
              type="button"
              onClick={() => { setBusqueda(""); sincronizarUrl({ q: "" }); }}
              className="absolute right-0.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDesglose((d) => !d)}
            title="Mostrar las columnas de gravado y no gravado por separado"
          >
            <Columns3 size={14} className="text-muted-foreground" />
            {desglose ? "Ocultar desglose" : "Ver desglose 21% / NG"}
          </Button>
          <ExportCostosButton
            mes={mes}
            busqueda={busqueda}
            onError={(m) => setAviso({ variant: "error", message: m })}
            onDone={() => setAviso({ variant: "success", message: "Excel descargado" })}
          />
          {canWrite && (
            <AddCostoDialog
              key={mes ?? "todos"}
              mesInicial={mes ? mes.slice(0, 7) : undefined}
              proveedores={proveedores}
              onSaved={onCostoGuardado}
            >
              <Button size="sm">
                <Plus size={14} /> Cargar costo
              </Button>
            </AddCostoDialog>
          )}
        </div>
      </div>

      {/* Barra de selección: aparece sólo cuando hay algo tildado, para poder
          deshacer un mes cargado mal sin confirmar treinta veces. */}
      {canWrite && seleccion.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs">
          <span className="text-foreground">
            <strong>{seleccion.size}</strong>{" "}
            {seleccion.size === 1 ? "seleccionado" : "seleccionados"} ·{" "}
            <span className="font-mono">{ars(totalSeleccionado)}</span>
          </span>
          {!todasSeleccionadas && (
            <button type="button" onClick={alternarTodas} className="text-primary hover:underline">
              Seleccionar los {filtradas.length} que se ven
            </button>
          )}
          <button
            type="button"
            onClick={() => setSeleccion(new Set())}
            className="text-muted-foreground hover:text-foreground"
          >
            Limpiar selección
          </button>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={() => setConfirmaLote(true)}
          >
            <Trash2 size={14} /> Eliminar ({seleccion.size})
          </Button>
        </div>
      )}

      {/* Tabla. En celular la tabla no entra (y con el desglose son 11
          columnas): scrollea de costado y la columna del proveedor queda fija a
          la izquierda, que si no uno no sabe de quién es el número que mira.
          Desde md se apaga: ahí entra sola y el hover de la fila se ve entero. */}
      <div
        className="rounded-xl border border-border bg-card overflow-x-auto
          max-md:[&_thead_th:first-child]:sticky max-md:[&_thead_th:first-child]:left-0 max-md:[&_thead_th:first-child]:z-20 max-md:[&_thead_th:first-child]:bg-card max-md:[&_thead_th:first-child]:border-r max-md:[&_thead_th:first-child]:border-border
          max-md:[&_tbody_td:first-child]:sticky max-md:[&_tbody_td:first-child]:left-0 max-md:[&_tbody_td:first-child]:z-10 max-md:[&_tbody_td:first-child]:bg-card max-md:[&_tbody_td:first-child]:border-r max-md:[&_tbody_td:first-child]:border-border max-md:[&_tbody_td:first-child]:max-w-[9.5rem]
          max-md:[&_tfoot_td:first-child]:sticky max-md:[&_tfoot_td:first-child]:left-0 max-md:[&_tfoot_td:first-child]:z-10 max-md:[&_tfoot_td:first-child]:bg-card max-md:[&_tfoot_td:first-child]:border-r max-md:[&_tfoot_td:first-child]:border-border"
      >
        {loading ? (
          <p className="text-xs text-muted-foreground p-6 flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Cargando…
          </p>
        ) : filtradas.length === 0 ? (
          <div className="p-4 sm:p-6 lg:p-8 text-center">
            <Wrench size={22} className="mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">
              {hayFiltro
                ? `Ningún proveedor coincide con "${busqueda.trim()}".`
                : "Sin costos cargados para este período."}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <ThOrden label="Proveedor" campo="proveedor" orden={orden} onOrdenar={ordenarPor} alineacion="left" />
                {mes === null && (
                  <ThOrden label="Mes" campo="mes" orden={orden} onOrdenar={ordenarPor} alineacion="left" />
                )}
                {desglose && (
                  <>
                    <th className={`text-right ${th}`}>Neto 21%</th>
                    <th className={`text-right ${th}`}>Fact. 21%</th>
                    <th className={`text-right ${th}`}>Neto NG</th>
                    <th className={`text-right ${th}`}>Fact. NG</th>
                  </>
                )}
                <ThOrden label="Neto" campo="neto" orden={orden} onOrdenar={ordenarPor} />
                <ThOrden label="IVA" campo="iva" orden={orden} onOrdenar={ordenarPor} />
                <ThOrden label="Facturado" campo="facturado" orden={orden} onOrdenar={ordenarPor} />
                <th className={`text-right ${th}`}>Participación</th>
                <th className="px-2" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => {
                const facturado = Number(r.facturado_total);
                const neto = Number(r.neto_total);
                const parte = (facturado / baseParticipacion) * 100;
                const credito = facturado < 0;
                // Hay filas donde 21% + NG no llega al total. Los importes se
                // dejan como vinieron; se avisa al mirar el desglose para que
                // nadie crea que la resta está mal calculada acá.
                const descuadre =
                  Math.abs(Number(r.neto_gravado) + Number(r.neto_ng) - neto) > 0.01 ||
                  Math.abs(Number(r.facturado_gravado) + Number(r.facturado_ng) - facturado) > 0.01;
                const tildada = seleccion.has(r.id);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setProveedorAbierto(r.proveedor)}
                    className={`border-b border-border/60 cursor-pointer ${tildada ? "bg-primary/[0.06]" : "hover:bg-muted/30"}`}
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-foreground/90">
                        {canWrite && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${r.proveedor}`}
                            checked={tildada}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => alternarUna(r.id)}
                            className="size-3.5 shrink-0 cursor-pointer accent-[#0088D1]"
                          />
                        )}
                        {r.proveedor}
                        <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
                      </span>
                      {credito && (
                        <span className="text-[11px] text-[#F59E0B]">Nota de crédito</span>
                      )}
                      {desglose && descuadre && (
                        <span className="block text-[11px] text-[#F59E0B]">
                          El 21% y el NG no llegan al total
                        </span>
                      )}
                      {r.observaciones && (
                        <span className="block text-[11px] text-muted-foreground">{r.observaciones}</span>
                      )}
                    </td>
                    {mes === null && (
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {mesLabel(r.mes)}
                      </td>
                    )}
                    {desglose && (
                      <>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{r.neto_gravado ? ars(r.neto_gravado) : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{r.facturado_gravado ? ars(r.facturado_gravado) : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{r.neto_ng ? ars(r.neto_ng) : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{r.facturado_ng ? ars(r.facturado_ng) : "—"}</td>
                      </>
                    )}
                    <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{ars(neto)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-foreground/80 whitespace-nowrap">{ars(facturado - neto)}</td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono font-semibold whitespace-nowrap ${
                        credito ? "text-[#F59E0B]" : "text-foreground"
                      }`}
                    >
                      {ars(facturado)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 rounded bg-muted overflow-hidden shrink-0">
                          <span
                            className="block h-full rounded bg-[#0088D1]"
                            style={{ width: `${Math.max(0, Math.min(100, parte))}%` }}
                          />
                        </span>
                        <span className="font-mono text-muted-foreground w-11 text-right">
                          {porcentaje(parte)}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {canWrite && (
                        <span className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditando(r); }}
                            className="inline-flex size-8 md:size-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setABorrar(r); }}
                            className="inline-flex size-8 md:size-6 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold text-foreground bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">
                  Total ({filtradas.length}
                  {hayFiltro ? ` de ${rows.length}` : ""})
                </td>
                {mes === null && <td />}
                {desglose && (
                  <>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.netoGrav)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.factGrav)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.netoNg)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.factNg)}</td>
                  </>
                )}
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.neto)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.iva)}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{ars(totales.facturado)}</td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">100,0%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      </>
      )}

      <ProveedorSheet proveedor={proveedorAbierto} onClose={() => setProveedorAbierto(null)} />

      {canWrite && (
        <AddCostoDialog
          key={editando?.id ?? "sin-edicion"}
          costo={editando}
          open={editando !== null}
          onOpenChange={(o) => { if (!o) setEditando(null); }}
          proveedores={proveedores}
          onSaved={onCostoGuardado}
        />
      )}

      <ConfirmDialog
        open={confirmaLote}
        onOpenChange={(o) => { if (!o) setConfirmaLote(false); }}
        title={`Eliminar ${seleccion.size} ${seleccion.size === 1 ? "costo" : "costos"}`}
        description={
          <>
            Se eliminan <strong>{seleccion.size}</strong>{" "}
            {seleccion.size === 1 ? "costo" : "costos"} de{" "}
            {mesesSeleccionados.length === 1
              ? mesLabel(mesesSeleccionados[0])
              : `${mesesSeleccionados.length} meses`}{" "}
            por un total de {ars(totalSeleccionado)}. No se puede deshacer.
          </>
        }
        confirmLabel={`Eliminar ${seleccion.size}`}
        onConfirm={confirmarBorradoLote}
        loading={borrandoLote}
      />

      <ConfirmDialog
        open={aBorrar !== null}
        onOpenChange={(o) => { if (!o) setABorrar(null); }}
        title="Eliminar costo"
        description={
          aBorrar ? (
            <>
              Se elimina el costo de <strong>{aBorrar.proveedor}</strong> de{" "}
              {mesLabel(aBorrar.mes)} por {ars(aBorrar.facturado_total)}. No se puede deshacer.
            </>
          ) : undefined
        }
        onConfirm={confirmarBorrado}
        loading={borrando}
      />
    </div>
  );
}
