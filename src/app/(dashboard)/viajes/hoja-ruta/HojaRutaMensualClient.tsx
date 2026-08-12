"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Users,
  Search,
  Loader2,
  FileSpreadsheet,
  Truck,
  Receipt,
  AlertTriangle,
  Maximize2,
  Edit3,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/ui/MonthPicker";
import ExportarHojaRuta from "./ExportarHojaRuta";
import {
  getPanelChoferAction,
  getViajesSinRemitoMesAction,
  listChoferesMesAction,
  actualizarViajesHojaRutaAction,
  type HrChoferListItem,
  type HrPanelChofer,
  type HrViajeItem,
  type HrViajeSinRemito,
} from "./actions";
import { deleteViajeAction } from "../actions";
import EditViajeDialog from "../components/EditViajeDialog";
import { aCambio, borradorDe, borradorSucio, type Borrador } from "./borradores";
import type { ViajeBasico } from "../types";
import { coincideBusqueda } from "@/lib/texto";
import { useBorrador } from "@/hooks/useBorrador";
import { useCambiosSinGuardar } from "@/hooks/useCambiosSinGuardar";
import AvisoBorrador from "@/components/borradores/AvisoBorrador";
import { useNovedades } from "@/hooks/useEnVivo";
import BarraNovedades from "@/components/envivo/BarraNovedades";

import { etiquetaRutaVia } from "@/domain/viajes/ruta-via";

/**
 * Lo que se estaba corrigiendo en la hoja, por id de viaje.
 *
 * Cada campo es texto porque sale de un input; los que falten se completan
 * vacíos, así un borrador guardado antes de que la hoja tuviera una columna no
 * rompe la pantalla al volver.
 */
function normalizarBorradorHojaRuta(crudo: unknown): Record<string, Borrador> | null {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;

  const texto = (x: unknown) => (typeof x === "string" ? x : "");
  const out: Record<string, Borrador> = {};
  for (const [id, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const b = v as Record<string, unknown>;
    out[id] = {
      origen: texto(b.origen),
      destino: texto(b.destino),
      km: texto(b.km),
      kmVacios: texto(b.kmVacios),
      toneladas: texto(b.toneladas),
      remito: texto(b.remito),
      monto: texto(b.monto),
    };
  }
  return Object.keys(out).length ? out : null;
}

// Helpers ---------------------------------------------------------------------

function fmtFecha(iso: string): string {
  const [, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}`;
}
function fmtFechaLarga(iso: string): string {
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
function fmtARS(n: number | null | undefined, opt?: { signed?: boolean }): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const str = abs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${opt?.signed && n < 0 ? "-" : ""}$ ${str}`;
}
function fmtNum(n: number | null | undefined, decimales = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}
function fmtMesLabel(mesISO: string): string {
  if (mesISO === "total") return "Histórico (todos los meses)";
  const [y, m] = mesISO.split("-").map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, 1);
  const txt = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// Componente principal --------------------------------------------------------

export default function HojaRutaMensualClient({
  mesInicial,
  choferIdInicial,
  choferes,
  canWrite,
}: {
  mesInicial: string;
  choferIdInicial: string | null;
  choferes: HrChoferListItem[];
  canWrite: boolean;
}) {
  const [mes, setMes] = useState(mesInicial);
  // La lista del sidebar/stats se recalcula al cambiar de mes (antes quedaba
  // congelada en el mes inicial). El prop cubre el primer render (SSR).
  const [choferesMes, setChoferesMes] = useState(choferes);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [choferId, setChoferId] = useState<string | null>(
    choferIdInicial ?? (choferes.find((c) => c.viajes > 0)?.id ?? choferes[0]?.id ?? null),
  );
  const [busqueda, setBusqueda] = useState("");
  const [soloConViajes, setSoloConViajes] = useState(true);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [panel, setPanel] = useState<HrPanelChofer | null>(null);
  // Vista "sin remito": los viajes que faltan de TODOS los choferes, sin tener
  // que entrar uno por uno a buscarlos.
  const [vistaSinRemito, setVistaSinRemito] = useState(false);
  const [sinRemito, setSinRemito] = useState<HrViajeSinRemito[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [, startTransition] = useTransition();

  // Refresh el panel cuando cambia chofer o mes
  useEffect(() => {
    if (!choferId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setPanel(null);
      return;
    }
    let cancelled = false;
    setCargando(true);
    getPanelChoferAction(choferId, mes).then((res) => {
      if (cancelled) return;
      setPanel(res);
      setCargando(false);
    });
    return () => {
      cancelled = true;
    };
  }, [choferId, mes]);

  // Cambiar de mes: actualiza el mes y recalcula la lista del sidebar + stats
  // (antes la lista quedaba congelada en el mes inicial). El panel del chofer se
  // refresca solo por su propio effect que depende de `mes`.
  const cambiarMes = useCallback((nuevoMes: string) => {
    setMes(nuevoMes);
    setCargandoLista(true);
    listChoferesMesAction(nuevoMes).then((res) => {
      setChoferesMes(res);
      setCargandoLista(false);
    });
  }, []);

  // URL sin reload (estado URL para volver)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mes", mes);
    if (choferId) url.searchParams.set("chofer", choferId);
    else url.searchParams.delete("chofer");
    window.history.replaceState(null, "", url.toString());
  }, [mes, choferId]);

  // Filtrar la lista de choferes del sidebar
  const choferesFiltrados = useMemo(() => {
    return choferesMes.filter((c) => {
      if (soloConViajes && c.viajes === 0) return false;
      if (soloPendientes && c.pendientesFacturar === 0) return false;
      // Sin acentos: "benitez" tiene que encontrar a "Benítez".
      return coincideBusqueda(`${c.apellido} ${c.nombre}`, busqueda);
    });
  }, [choferesMes, busqueda, soloConViajes, soloPendientes]);

  const refresh = () => {
    if (!choferId) return;
    startTransition(async () => {
      // Panel + lista del sidebar juntos: borrar o editar un viaje también
      // cambia los contadores y stats del mes.
      const [res, lista] = await Promise.all([
        getPanelChoferAction(choferId, mes),
        listChoferesMesAction(mes),
      ]);
      setPanel(res);
      setChoferesMes(lista);
    });
  };

  // ── En vivo: si otro corrige un viaje del mes, la hoja se pone al día.
  //
  // Recargar acá es seguro aunque haya correcciones a medio tipear: los
  // borradores de fila viven aparte, indexados por viaje, y `borradorPara` les
  // da prioridad sobre lo que llega del servidor. Lo que se está escribiendo no
  // se pierde.
  const { novedades: viajesNuevos, ver: verViajesNuevos } = useNovedades({
    seccion: "viajes",
    recargar: refresh,
  });

  // Stats globales del mes (todos los choferes)
  const abrirSinRemito = async () => {
    if (vistaSinRemito) {
      setVistaSinRemito(false);
      return;
    }
    setVistaSinRemito(true);
    setSinRemito(null);
    setSinRemito(await getViajesSinRemitoMesAction(mes));
  };

  // Al cambiar de mes o de chofer, la vista vuelve al chofer.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- salir de la vista cruzada al cambiar de contexto
    setVistaSinRemito(false);
  }, [mes, choferId]);

  const statsMes = useMemo(() => {
    return choferesMes.reduce(
      (acc, c) => {
        acc.viajes += c.viajes;
        acc.importe += c.totalImporte;
        acc.tn += c.totalTn;
        acc.km += c.totalKm;
        acc.kmVacios += c.totalKmVacios;
        acc.pendientes += c.pendientesFacturar;
        acc.sinRemito += c.sinRemito;
        acc.choferesActivos += c.viajes > 0 ? 1 : 0;
        return acc;
      },
      { viajes: 0, importe: 0, tn: 0, km: 0, kmVacios: 0, pendientes: 0, sinRemito: 0, choferesActivos: 0 },
    );
  }, [choferesMes]);

  return (
    // En el celular la pantalla no se parte en dos columnas de alto fijo: la
    // lista de choferes va arriba (con su propio scroll acotado) y la hoja
    // abajo, y scrollea la página entera. De `lg` para arriba vuelve el layout
    // de dos paneles con alto fijo.
    <div className="flex flex-col lg:h-[calc(100vh-84px)] gap-3 p-4 sm:p-6">
      {/* Alguien tocó viajes del mes mientras estabas corrigiendo. */}
      <BarraNovedades
        cantidad={viajesNuevos}
        onVer={verViajesNuevos}
        sustantivo="cambio en los viajes"
        sustantivoPlural="cambios en los viajes"
      />

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-foreground text-lg sm:text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary shrink-0" />
            Hoja de Ruta — {fmtMesLabel(mes)}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Una página por chofer con todos sus viajes del mes. Misma estructura que la
            planilla Excel del cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cargandoLista && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          <MonthPicker value={mes} onChange={cambiarMes} allowTotal />
          <ExportarHojaRuta
            mes={mes}
            // En la vista "sin remito" no hay un chofer abierto: el export sale
            // de todos, que es lo que se está mirando.
            choferId={vistaSinRemito ? null : choferId}
            choferLabel={
              vistaSinRemito
                ? null
                : (() => {
                    const c = choferesMes.find((x) => x.id === choferId);
                    return c ? `${c.apellido}, ${c.nombre}` : null;
                  })()
            }
          />
        </div>
      </div>

      {/* ─── Stats del mes ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 shrink-0">
        <StatChip icon={<Users size={14} />} label="Choferes con viajes" value={`${statsMes.choferesActivos}/${choferesMes.length}`} tone="info" />
        <StatChip icon={<Receipt size={14} />} label="Viajes del mes" value={fmtNum(statsMes.viajes)} tone="brand" />
        <StatChip icon={<Truck size={14} />} label="Toneladas" value={fmtNum(statsMes.tn, 1)} tone="info" />
        <StatChip icon={<Truck size={14} />} label="KM cargados" value={fmtNum(statsMes.km)} tone="neutral" />
        {/* Lo que falta para poder facturar. Clic y muestra cuáles son, de
            todos los choferes, sin tener que entrar uno por uno. */}
        <StatChip
          icon={<AlertTriangle size={14} />}
          label="Sin remito"
          value={fmtNum(statsMes.sinRemito)}
          tone={statsMes.sinRemito > 0 ? "warning" : "neutral"}
          onClick={statsMes.sinRemito > 0 ? () => abrirSinRemito() : undefined}
          activo={vistaSinRemito}
        />
        <StatChip icon={<Receipt size={14} />} label="Facturado" value={fmtARS(statsMes.importe)} tone="success" />
      </div>

      {/* ─── Layout: sidebar + panel ─── */}
      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-0 lg:gap-3 border border-border rounded-[8px] bg-card overflow-hidden">
        {/* Sidebar choferes (estilo tabs del Excel) */}
        <aside className="w-full lg:w-72 shrink-0 max-h-[45vh] lg:max-h-none border-b lg:border-b-0 lg:border-r border-border flex flex-col">
          <div className="p-2 space-y-1.5 border-b border-border bg-muted/40">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 z-10" />
              <Input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar chofer…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
              <label className="inline-flex items-center gap-1.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={soloConViajes}
                  onChange={(e) => setSoloConViajes(e.target.checked)}
                  className="size-4 sm:size-3 accent-[#0088D1]"
                />
                Con viajes
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={soloPendientes}
                  onChange={(e) => setSoloPendientes(e.target.checked)}
                  className="size-4 sm:size-3 accent-[#F59E0B]"
                />
                Pendientes
              </label>
            </div>
          </div>
          <ul className="overflow-y-auto flex-1 min-h-0 divide-y divide-border">
            {choferesFiltrados.map((c) => {
              const active = c.id === choferId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setChoferId(c.id)}
                    className={`w-full text-left px-3 py-2 transition-colors ${
                      active
                        ? "bg-[#E1F5FE] border-l-4 border-[#0088D1]"
                        : "hover:bg-muted/40 border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold truncate ${active ? "text-primary" : "text-foreground"}`}>
                        {c.apellido}, {c.nombre}
                        {c.estado === "baja" && (
                          <span className="ml-1 text-[9px] font-normal uppercase tracking-wide text-muted-foreground/70">
                            egresado
                          </span>
                        )}
                      </span>
                      {c.pendientesFacturar > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-[#FEF3C7] text-[#92400E] text-[9px] font-bold px-1"
                          title={`${c.pendientesFacturar} viajes sin importe (pendientes de facturar)`}
                        >
                          {c.pendientesFacturar}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{c.viajes} viajes</span>
                      {c.totalTn > 0 && <span>· {fmtNum(c.totalTn, 1)} tn</span>}
                      {c.totalImporte > 0 && <span className="text-[#10B981] font-semibold">· {fmtARS(c.totalImporte)}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
            {choferesFiltrados.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                Sin choferes con esos filtros
              </li>
            )}
          </ul>
        </aside>

        {/* Panel chofer */}
        <section className="flex-1 min-w-0 lg:overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-16 lg:h-full text-muted-foreground gap-2">
              <Loader2 size={18} className="animate-spin" />
              Cargando hoja de ruta…
            </div>
          ) : vistaSinRemito ? (
            <PanelSinRemito
              viajes={sinRemito}
              mes={mes}
              canWrite={canWrite}
              onChanged={async () => {
                refresh();
                setSinRemito(await getViajesSinRemitoMesAction(mes));
              }}
              onCerrar={() => setVistaSinRemito(false)}
            />
          ) : !panel ? (
            <div className="flex flex-col items-center justify-center py-16 lg:h-full text-muted-foreground gap-2 p-6 text-center">
              <FileSpreadsheet size={32} className="opacity-40" />
              <p className="text-sm">Elegí un chofer del sidebar para ver su hoja de ruta.</p>
            </div>
          ) : (
            <PanelChofer
              panel={panel}
              canWrite={canWrite}
              onChanged={refresh}
              ambito={`${mes}:${panel.id}`}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Los viajes sin remito del mes, de todos los choferes.
 *
 * Reusa el panel del chofer con una ficha armada al vuelo: la tabla, la edición
 * y el guardado son exactamente los mismos, así que se completa el remito acá
 * sin ir a buscar a cada chofer. La columna "Chofer" aparece sólo en esta vista,
 * porque acá sí hace falta saber de quién es cada viaje.
 */
function PanelSinRemito({
  viajes,
  mes,
  canWrite,
  onChanged,
  onCerrar,
}: {
  viajes: HrViajeSinRemito[] | null;
  mes: string;
  canWrite: boolean;
  onChanged: () => void;
  onCerrar: () => void;
}) {
  if (viajes === null) {
    return (
      <div className="flex items-center justify-center py-16 lg:h-full text-muted-foreground gap-2 p-6">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Buscando los viajes sin remito…</span>
      </div>
    );
  }

  const totales = viajes.reduce(
    (acc, v) => {
      acc.cantidad++;
      acc.km += v.km_con_carga;
      acc.kmVacios += v.km_vacios;
      acc.tonelaje += v.tonelaje_real ?? 0;
      acc.importe += v.monto_flete ?? 0;
      if (v.monto_flete == null) acc.pendientesFacturar++;
      acc.sinRemito++;
      return acc;
    },
    { cantidad: 0, km: 0, kmVacios: 0, tonelaje: 0, importe: 0, vacios: 0, pendientesFacturar: 0, sinRemito: 0 },
  );

  const panel: HrPanelChofer = {
    id: "sin-remito",
    apellido: "Sin remito",
    nombre: `${viajes.length} viaje${viajes.length !== 1 ? "s" : ""} del mes`,
    patentes_actuales: [],
    patentes_del_mes: [],
    viajes,
    totales,
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border bg-[#FFFBEB] px-4 sm:px-5 py-2.5">
        <p className="text-[12.5px] font-semibold text-[#92400E]">
          Viajes de {fmtMesLabel(mes)} que todavía no tienen remito, de todos los choferes.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-2.5 rounded-md border border-border bg-card text-[12px] font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <X size={13} />
          Volver al chofer
        </button>
      </div>
      {viajes.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Todos los viajes del mes tienen su remito cargado.
        </div>
      ) : (
        <PanelChofer
          panel={panel}
          canWrite={canWrite}
          onChanged={onChanged}
          ambito={`${mes}:sin-remito`}
          mostrarChofer
        />
      )}
    </div>
  );
}

// ===========================================================================
// Panel chofer (estilo sheet del Excel)
// ===========================================================================

/**
 * La fila de la hoja de ruta con la forma que espera el modal de detalle. El
 * modal vuelve a leer el viaje del server apenas abre, así que lo que va acá es
 * el punto de partida, no la verdad.
 */
function aViajeBasico(v: HrViajeItem, chofer: string): ViajeBasico {
  return {
    id: v.id,
    codigo: v.codigo,
    fecha_viaje: v.fecha_viaje,
    origen: v.origen,
    destino: v.destino,
    cliente: v.cliente,
    toneladas: v.tonelaje_real,
    km_totales: (v.km_con_carga ?? 0) + (v.km_vacios ?? 0),
    km_con_carga: v.km_con_carga,
    km_vacios: v.km_vacios,
    estado: v.estado,
    facturado: v.facturado,
    cobrado: v.facturado,
    fecha_cobro: null,
    chofer,
    camion: null,
    monto_flete: v.monto_flete,
    moneda: "ARS",
    observaciones: v.observaciones,
    nro_viaje_ypf: v.nro_viaje_ypf,
    nro_remito: v.nro_remito,
    material: v.material,
    es_vacio: v.es_vacio,
  };
}


function PanelChofer({
  panel,
  canWrite,
  onChanged,
  ambito,
  mostrarChofer = false,
}: {
  panel: HrPanelChofer;
  canWrite: boolean;
  onChanged: () => void;
  /** Qué hoja se está corrigiendo, para que el borrador no se mezcle entre meses ni choferes. */
  ambito: string;
  /** Agrega la columna Chofer: sólo hace falta en la vista que cruza choferes. */
  mostrarChofer?: boolean;
}) {
  // Edición: una fila sola (el lápiz) o toda la hoja a la vez. Los borradores
  // viven acá y no en cada fila, porque "guardar todo" necesita verlos juntos.
  const [modoTodos, setModoTodos] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  // Para lo que no entra en la fila: cliente, tipo de carga, ruta, tonelaje,
  // vía… El modal de detalle es el mismo del listado.
  const [detalle, setDetalle] = useState<HrViajeItem | null>(null);

  const borradorPara = (v: HrViajeItem) => borradores[v.id] ?? borradorDe(v);
  const sucios = panel.viajes.filter((v) => borradores[v.id] && borradorSucio(v, borradores[v.id]!));

  // ── Borrador local: corregir un mes entero son muchas filas tipeadas a mano,
  // y hasta que no se toca "Guardar todo" viven sólo en memoria.
  //
  // Se guardan SÓLO las filas sucias. Guardar todas traería de vuelta el valor
  // que tenía la fila cuando se abrió la pantalla, y eso es exactamente el
  // pisotón silencioso que `aCambio` está escrito para evitar: si en el medio
  // alguien cargó el DM de YPF o el importe, se borraría.
  const sucioPorId = useMemo(() => {
    const out: Record<string, Borrador> = {};
    for (const v of panel.viajes) {
      const b = borradores[v.id];
      if (b && borradorSucio(v, b)) out[v.id] = b;
    }
    return out;
  }, [panel.viajes, borradores]);

  const borradorLocal = useBorrador({
    pantalla: `viajes-hoja-ruta:${ambito}`,
    valor: sucioPorId,
    normalizar: normalizarBorradorHojaRuta,
    hayDatos: (b) => Object.keys(b).length > 0,
    activo: canWrite,
  });

  useCambiosSinGuardar(canWrite && sucios.length > 0);

  const recuperarBorrador = () => {
    const b = borradorLocal.recuperar();
    if (!b) return;
    // Sólo las filas que siguen estando en la hoja: si un viaje se borró o se
    // facturó desde otra sesión, su corrección vieja ya no aplica.
    const vigentes = new Set(panel.viajes.map((v) => v.id));
    const aplicables = Object.fromEntries(Object.entries(b).filter(([id]) => vigentes.has(id)));
    setBorradores((prev) => ({ ...prev, ...aplicables }));
    setModoTodos(true);
  };

  const limpiar = () => {
    setModoTodos(false);
    setEditandoId(null);
    setBorradores({});
    setErrorGuardar(null);
    borradorLocal.limpiar();
  };

  const guardarLote = async (viajes: HrViajeItem[]) => {
    const cambios = viajes
      .filter((v) => borradores[v.id] && borradorSucio(v, borradores[v.id]!))
      .map((v) => aCambio(v, borradores[v.id]!));
    if (cambios.length === 0) {
      limpiar();
      return;
    }
    setGuardando(true);
    setErrorGuardar(null);
    const res = await actualizarViajesHojaRutaAction(cambios);
    setGuardando(false);
    if ("error" in res) {
      setErrorGuardar(res.error);
      // Si entró parte del lote hay que recargar igual: dejar la tabla con los
      // valores viejos hace creer que no se guardó nada.
      if (res.guardados > 0) {
        setBorradores({});
        // Entró parte del lote: el borrador viejo ya no representa nada y
        // ofrecerlo después sería volver a mandar correcciones ya aplicadas.
        borradorLocal.limpiar();
        onChanged();
      }
      return;
    }
    limpiar();
    onChanged();
  };

  // Los lugares que ya aparecen en el mes, para sugerir al corregir un destino
  // sin obligar a tipearlo entero. Igual acepta uno nuevo.
  const lugares = [
    ...new Set(
      panel.viajes.flatMap((v) => [v.origen, v.destino]).filter((x): x is string => !!x),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {borradorLocal.pendiente && (
        <AvisoBorrador
          ts={borradorLocal.pendiente.ts}
          detalle={`${Object.keys(borradorLocal.pendiente.valor).length} fila(s) corregida(s)`}
          onRecuperar={recuperarBorrador}
          onDescartar={borradorLocal.descartar}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-foreground text-lg font-bold">
            {mostrarChofer ? panel.apellido : `${panel.apellido}, ${panel.nombre}`}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-muted-foreground">
            {mostrarChofer ? (
              <span>{panel.nombre}</span>
            ) : panel.patentes_del_mes.length > 0 ? (
              panel.patentes_del_mes.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E1F5FE] text-[#075985] font-mono font-semibold">
                  <Truck size={10} />
                  {p}
                </span>
              ))
            ) : panel.patentes_actuales.length > 0 ? (
              panel.patentes_actuales.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  <Truck size={10} />
                  {p}
                </span>
              ))
            ) : (
              <span className="italic">Sin camión asignado</span>
            )}
          </div>
        </div>
        {/* Totales del chofer */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Mini label="Viajes" value={fmtNum(panel.totales.cantidad)} />
          <Mini label="KM" value={fmtNum(panel.totales.km)} />
          <Mini label="KM vacíos" value={fmtNum(panel.totales.kmVacios)} tone="muted" />
          <Mini label="Toneladas" value={fmtNum(panel.totales.tonelaje, 1)} />
          <Mini label="Importe" value={fmtARS(panel.totales.importe)} tone="success" />
          {panel.totales.pendientesFacturar > 0 && (
            <Mini label="Pend. facturar" value={fmtNum(panel.totales.pendientesFacturar)} tone="warning" />
          )}
        </div>
      </div>

      {/* Tabla estilo Excel */}
      {panel.viajes.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[8px] py-10 text-center text-sm text-muted-foreground">
          Este chofer no tiene viajes cargados en este mes.
        </div>
      ) : (
        <>
        {/* Corregir de a una era abrir, editar, guardar y cerrar por cada
            viaje. Con 100 viajes en el mes eso es la mayor parte del trabajo. */}
        {canWrite && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {modoTodos ? (
              <>
                <p className="text-[12px] text-muted-foreground">
                  Editando toda la hoja.{" "}
                  {sucios.length > 0 ? (
                    <span className="font-medium text-primary">
                      {sucios.length} viaje{sucios.length !== 1 ? "s" : ""} sin guardar
                    </span>
                  ) : (
                    "Corregí lo que haga falta y guardá una vez."
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={limpiar}
                    disabled={guardando}
                    className="inline-flex h-9 sm:h-8 items-center rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => guardarLote(panel.viajes)}
                    disabled={guardando || sucios.length === 0}
                    className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {guardando ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {guardando
                      ? "Guardando…"
                      : sucios.length === 0
                        ? "Sin cambios"
                        : `Guardar ${sucios.length}`}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditandoId(null);
                  setModoTodos(true);
                }}
                className="inline-flex h-9 sm:h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
                title="Abrir todas las filas para corregirlas de una vez"
              >
                <Edit3 size={12} className="text-primary" />
                Editar toda la hoja
              </button>
            )}
          </div>
        )}

        {errorGuardar && (
          <p className="border-l-2 border-red-600 pl-3 text-[12px] text-red-600">{errorGuardar}</p>
        )}

        <div className="overflow-x-auto border border-border rounded-[8px]">
          {/* El min-w obliga a la tabla a scrollear de costado en vez de
              aplastar las columnas en el celular. */}
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-[#0F172A] text-white">
              <tr>
                {mostrarChofer && <Th>Chofer</Th>}
                <Th>Día</Th>
                <Th>Sale de</Th>
                <Th>Llega a</Th>
                <Th>Ruta</Th>
                <Th right>KM</Th>
                <Th right>Toneladas</Th>
                <Th>Remito Nº</Th>
                <Th>Material / Cliente</Th>
                <Th right>KM vacíos</Th>
                <Th right>Importe ($)</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {panel.viajes.map((v) => (
                <FilaViaje
                  key={v.id}
                  viaje={v}
                  canWrite={canWrite}
                  onChanged={onChanged}
                  lugares={lugares}
                  editando={modoTodos || editandoId === v.id}
                  modoTodos={modoTodos}
                  onEditar={() => setEditandoId(v.id)}
                  onCancelar={limpiar}
                  onGuardar={() => guardarLote([v])}
                  guardando={guardando}
                  mostrarChofer={mostrarChofer}
                  borrador={borradorPara(v)}
                  onDetalle={() => setDetalle(v)}
                  onBorrador={(patch) =>
                    setBorradores((prev) => ({
                      ...prev,
                      [v.id]: { ...borradorPara(v), ...patch },
                    }))
                  }
                />
              ))}
            </tbody>
            <tfoot className="bg-muted/40 border-t-2 border-border">
              <tr className="text-[11px] font-bold uppercase tracking-wider">
                {/* Día · Sale de · Llega a · Ruta, más Chofer si la vista cruza
                    choferes (si no, los totales salen corridos una columna). */}
                <td className="px-3 py-2.5" colSpan={4 + (mostrarChofer ? 1 : 0)}>TOTAL del mes</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(panel.totales.km)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtNum(panel.totales.tonelaje, 1)}</td>
                <td className="px-3 py-2.5" colSpan={2}></td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtNum(panel.totales.kmVacios)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[#10B981]">{fmtARS(panel.totales.importe)}</td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}

      {detalle && (
        <EditViajeDialog
          viaje={aViajeBasico(detalle, `${panel.apellido}, ${panel.nombre}`)}
          open
          onOpenChange={(v) => !v && setDetalle(null)}
          onSuccess={() => {
            setDetalle(null);
            limpiar();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Fila con edición inline de remito + monto
// ===========================================================================

function FilaViaje({
  viaje,
  canWrite,
  onChanged,
  lugares,
  editando,
  modoTodos,
  onEditar,
  onDetalle,
  onCancelar,
  onGuardar,
  guardando,
  borrador,
  onBorrador,
  mostrarChofer = false,
}: {
  viaje: HrViajeItem;
  canWrite: boolean;
  onChanged: () => void;
  /** Lugares ya cargados, para sugerir al corregir origen/destino. */
  lugares: string[];
  editando: boolean;
  /** true cuando se está editando la hoja entera: manda la barra de arriba. */
  modoTodos: boolean;
  onEditar: () => void;
  onDetalle: () => void;
  onCancelar: () => void;
  onGuardar: () => void;
  guardando: boolean;
  borrador: Borrador;
  onBorrador: (patch: Partial<Borrador>) => void;
  mostrarChofer?: boolean;
}) {
  const [borrando, setBorrando] = useState(false); // pidiendo confirmación
  const [eliminando, setEliminando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null);

  const esVacio = viaje.es_vacio;
  const esPendiente = !esVacio && viaje.monto_flete == null;
  const { origen, destino, km, kmVacios, toneladas, remito, monto } = borrador;

  const eliminar = async () => {
    setEliminando(true);
    const res = await deleteViajeAction(viaje.id);
    setEliminando(false);
    setBorrando(false);
    if (res.ok) onChanged();
    else setErrorBorrar(res.error ?? "No se pudo borrar el viaje.");
  };

  return (
    <tr
      className={`hover:bg-muted/30 transition-colors ${
        esPendiente ? "bg-[#FFFBEB]/40" : ""
      } ${esVacio ? "text-muted-foreground/70" : ""}`}
    >
      {mostrarChofer && (
        <td className="px-3 py-2 text-[11px] font-semibold whitespace-nowrap">
          {viaje.chofer ?? "—"}
        </td>
      )}
      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap" title={fmtFechaLarga(viaje.fecha_viaje)}>
        {fmtFecha(viaje.fecha_viaje)}
      </td>
      <td className="px-3 py-2">
        {editando ? (
          <input
            type="text"
            list={`hr-lugares-${viaje.id}`}
            value={origen}
            onChange={(e) => onBorrador({ origen: e.target.value })}
            placeholder="Sale de"
            className="h-8 sm:h-7 w-32 rounded border border-border px-2 text-xs uppercase outline-none focus:border-primary"
          />
        ) : (
          viaje.origen ?? "—"
        )}
      </td>
      <td className="px-3 py-2">
        {editando ? (
          <>
            <input
              type="text"
              list={`hr-lugares-${viaje.id}`}
              value={destino}
              onChange={(e) => onBorrador({ destino: e.target.value })}
              placeholder="Llega a"
              className="h-8 sm:h-7 w-32 rounded border border-border px-2 text-xs uppercase outline-none focus:border-primary"
            />
            {/* Los lugares ya cargados, para no tipear de nuevo; igual acepta
                uno nuevo y se da de alta solo. */}
            <datalist id={`hr-lugares-${viaje.id}`}>
              {lugares.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </>
        ) : (
          viaje.destino ?? "—"
        )}
      </td>
      {/* Sólo lectura, aun en modo edición: cambiar la vía tiene que recalcular
          los km del par (Ruta 5 directa vs Ruta 22 por la base), y eso lo hace
          el modal de detalle con el historial. Un select pelado acá dejaría
          "Ruta 22" con los km de la Ruta 5, justo lo que la columna evita. */}
      <td className="px-3 py-2 text-[11px] whitespace-nowrap">
        {etiquetaRutaVia(viaje.ruta_via)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {editando ? (
          <input
            type="number"
            min="0"
            value={km}
            onChange={(e) => onBorrador({ km: e.target.value })}
            placeholder="0"
            className="h-8 sm:h-7 w-24 sm:w-20 rounded border border-border px-2 text-right text-xs outline-none focus:border-primary"
          />
        ) : (
          fmtNum(viaje.km_con_carga)
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {editando ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={toneladas}
            onChange={(e) => onBorrador({ toneladas: e.target.value })}
            placeholder="0,00"
            className="h-8 sm:h-7 w-24 sm:w-20 rounded border border-border px-2 text-right text-xs outline-none focus:border-primary"
          />
        ) : viaje.tonelaje_real ? (
          fmtNum(viaje.tonelaje_real, 2)
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 font-mono text-[11px]">
        {editando ? (
          <input
            type="text"
            value={remito}
            onChange={(e) => onBorrador({ remito: e.target.value })}
            placeholder="Nº remito"
            className="w-28 sm:w-24 h-8 sm:h-7 px-2 text-xs rounded border border-border focus:border-primary outline-none"
          />
        ) : esVacio ? (
          // Igual que la planilla Excel del cliente: "VACIO" en rojo en la columna remito.
          <span className="text-[#C00000] font-bold">VACIO</span>
        ) : (
          // La columna remito muestra el remito y nada más: no depende del importe.
          viaje.nro_remito ?? "—"
        )}
      </td>
      <td className="px-3 py-2 text-[11px]">
        {viaje.material ?? viaje.cliente ?? "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
        {editando ? (
          <input
            type="number"
            min="0"
            value={kmVacios}
            onChange={(e) => onBorrador({ kmVacios: e.target.value })}
            placeholder="0"
            className="h-8 sm:h-7 w-24 sm:w-20 rounded border border-border px-2 text-right text-xs outline-none focus:border-primary"
          />
        ) : (
          fmtNum(viaje.km_vacios)
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {editando ? (
          <input
            type="number"
            value={monto}
            onChange={(e) => onBorrador({ monto: e.target.value })}
            placeholder="0.00"
            step="0.01"
            className="w-32 sm:w-28 h-8 sm:h-7 px-2 text-xs rounded border border-border focus:border-primary outline-none text-right"
          />
        ) : viaje.monto_flete != null ? (
          fmtARS(viaje.monto_flete)
        ) : (
          <span className="text-[#92400E] italic text-[10px]">sin importe</span>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {editando && !modoTodos ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onGuardar}
              disabled={guardando}
              className="inline-flex items-center justify-center size-8 sm:size-6 rounded text-[#10B981] hover:bg-[#ECFDF5]"
              title="Guardar"
            >
              {guardando ? <Loader2 size={11} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button
              type="button"
              onClick={onCancelar}
              disabled={guardando}
              className="inline-flex items-center justify-center size-8 sm:size-6 rounded text-muted-foreground hover:bg-muted"
              title="Cancelar"
            >
              <X size={12} />
            </button>
          </div>
        ) : borrando ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap">¿Borrar?</span>
            <button
              type="button"
              onClick={eliminar}
              disabled={eliminando}
              className="inline-flex items-center justify-center h-6 px-1.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-700"
              title="Sí, borrar el viaje"
            >
              {eliminando ? <Loader2 size={11} className="animate-spin" /> : "Sí"}
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              disabled={eliminando}
              className="inline-flex items-center justify-center h-6 px-1.5 rounded text-[10px] font-semibold border border-border text-muted-foreground hover:bg-muted"
              title="No borrar"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {canWrite && (
              <>
                {/* Todo lo que no entra en la fila: cliente, tipo de carga,
                    ruta, tonelaje, vía. */}
                <button
                  type="button"
                  onClick={onDetalle}
                  className="inline-flex size-8 sm:size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Abrir el viaje completo"
                >
                  <Maximize2 size={11} />
                </button>
                {!modoTodos && (
                <button
                  type="button"
                  onClick={onEditar}
                  className="inline-flex items-center justify-center size-8 sm:size-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Editar el viaje: origen, destino, km, remito y monto"
                >
                  <Edit3 size={11} />
                </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorBorrar(null);
                    setBorrando(true);
                  }}
                  className="inline-flex items-center justify-center size-8 sm:size-6 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Eliminar viaje (si lo cargaste mal o se canceló)"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        )}
        {errorBorrar && !borrando && (
          <p className="text-[10px] text-red-600 mt-0.5 max-w-[180px]">{errorBorrar}</p>
        )}
      </td>
    </tr>
  );
}

// Sub-componentes pequeños -----------------------------------------------------

function StatChip({
  icon, label, value, tone, onClick, activo,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "info" | "brand" | "success" | "warning" | "neutral";
  /** Si se pasa, la tarjeta es un botón. */
  onClick?: () => void;
  activo?: boolean;
}) {
  const cls =
    tone === "success" ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
    : tone === "warning" ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
    : tone === "brand" ? "border-[#BAE6FD] bg-[#E1F5FE] text-primary"
    : tone === "info" ? "border-[#BAE6FD] bg-[#F0F9FF] text-[#075985]"
    : "border-border bg-muted/40 text-muted-foreground";
  const cuerpo = (
    <>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 truncate">{label}</p>
        <p className="text-sm font-bold leading-tight truncate">{value}</p>
      </div>
    </>
  );
  const base = `border rounded-md px-3 py-2 flex items-center gap-2 ${cls}`;
  if (!onClick) return <div className={base}>{cuerpo}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title="Ver los viajes que todavía no tienen remito"
      className={`${base} w-full transition-all hover:brightness-95 ${activo ? "ring-2 ring-[#92400E]/40" : ""}`}
    >
      {cuerpo}
    </button>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "muted" | "success" | "warning" }) {
  const cls =
    tone === "success" ? "text-[#10B981]"
    : tone === "warning" ? "text-[#92400E]"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div className="inline-flex flex-col px-2 py-1 rounded bg-muted/40 border border-border min-w-[78px]">
      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/80">{label}</span>
      <span className={`text-xs font-mono font-bold ${cls}`}>{value}</span>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-[10px] uppercase tracking-widest font-bold whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
