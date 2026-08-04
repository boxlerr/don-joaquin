"use client";

import { useCallback, useMemo, useState } from "react";
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
  type CostoRepRep,
  type CostosResumenMes,
} from "./actions";
import { ars, mesCorto, mesLabel, porcentaje, variacion } from "./formato";

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
  rowsIniciales,
  resumen,
  proveedores,
  canWrite,
}: {
  mesInicial: string | null;
  rowsIniciales: CostoRepRep[];
  resumen: CostosResumenMes[];
  proveedores: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mes, setMes] = useState<string | null>(mesInicial);
  const [rows, setRows] = useState<CostoRepRep[]>(rowsIniciales);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>({ campo: "facturado", dir: "desc" });
  const [desglose, setDesglose] = useState(false);
  const [proveedorAbierto, setProveedorAbierto] = useState<string | null>(null);
  const [editando, setEditando] = useState<CostoRepRep | null>(null);
  const [aBorrar, setABorrar] = useState<CostoRepRep | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [aviso, setAviso] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [vista, setVista] = useState<Vista>("ver");
  const [carga, setCarga] = useState<{
    rows: CostoRepRep[];
    proveedoresPrevios: string[];
    mesPrevio: string | null;
  } | null>(null);
  const [todas, setTodas] = useState<CostoRepRep[] | null>(null);

  async function cambiarMes(nuevo: string | null) {
    setMes(nuevo);
    setLoading(true);
    setCarga(null);
    const data = await getCostosRepRepAction(nuevo);
    setRows(data);
    setLoading(false);
  }

  /** El comparativo necesita todos los meses, no sólo el que está elegido. */
  async function abrirComparativo() {
    setVista("comparar");
    if (todas !== null) return;
    setLoading(true);
    setTodas(await getCostosRepRepAction(null));
    setLoading(false);
  }

  /** Abre la planilla de un mes, exista o no: un mes sin datos también se carga. */
  async function abrirCarga(mesISO: string) {
    setVista("cargar");
    setMes(mesISO);
    setLoading(true);
    setCarga(null);
    const data = await getMesParaCargaAction(mesISO);
    setCarga(data);
    setRows(data.rows);
    setLoading(false);
  }

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

  /* --- Tira de meses: es el selector y a la vez la evolución del gasto ----- */
  const evolucion = useMemo(() => [...resumen].reverse(), [resumen]); // viejo → nuevo
  const maxMes = Math.max(1, ...evolucion.map((r) => Math.abs(r.facturado_total)));
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
                  const alto = Math.max(3, (Math.abs(r.facturado_total) / maxMes) * 48);
                  return (
                    <button
                      key={r.mes}
                      type="button"
                      onClick={() => cambiarMes(r.mes)}
                      title={`${mesLabel(r.mes)} — ${ars(r.facturado_total)} facturado · ${r.proveedores} proveedores`}
                      className="group flex flex-col items-center gap-1.5 shrink-0 w-9"
                    >
                      <span className="flex h-12 w-full items-end">
                        <span
                          className={`w-full rounded-[3px] transition-colors ${
                            activo ? "bg-[#0088D1]" : "bg-muted group-hover:bg-[#0088D1]/40"
                          }`}
                          style={{ height: `${alto}px` }}
                        />
                      </span>
                      <span
                        className={`text-[10px] leading-none whitespace-nowrap ${
                          activo ? "font-semibold text-primary" : "text-muted-foreground"
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
                else { setVista("ver"); setCarga(null); }
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
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar proveedor…"
            className="pl-8 pr-9 h-9"
            aria-label="Buscar proveedor"
          />
          {hayFiltro && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
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
                return (
                  <tr
                    key={r.id}
                    onClick={() => setProveedorAbierto(r.proveedor)}
                    className="border-b border-border/60 hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1 text-foreground/90">
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
