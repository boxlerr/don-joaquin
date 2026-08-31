"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import CalendarioPopover from "@/components/ui/CalendarioPopover";
import ImprimirPlanillaButton from "./ImprimirPlanillaButton";
import CambiosDrawer from "./CambiosDrawer";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
  History,
  CalendarClock,
  ArrowRight,
  Repeat2,
  Search,
  X,
} from "lucide-react";
import {
  guardarPlanillaDiariaAction,
  type PlanillaDiariaData,
} from "./actions";
import { nombreCompletoPersona, normalizarParaBuscar } from "@/lib/nombres";
import { useBorrador } from "@/hooks/useBorrador";
import { useCambiosSinGuardar } from "@/hooks/useCambiosSinGuardar";
import AvisoBorrador, { SelloBorrador } from "@/components/borradores/AvisoBorrador";
import { useNovedades } from "@/hooks/useEnVivo";
import BarraNovedades from "@/components/envivo/BarraNovedades";

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

// ── Borrador ──────────────────────────────────────────────────────────────────

/**
 * Lo que se cambió y todavía no se guardó, por chofer.
 *
 * Se guarda el CAMBIO y no la planilla entera a propósito: los nombres, el
 * camión habitual y el camión previo salen del servidor y pueden haber cambiado
 * desde ayer. Restaurar una foto vieja de todo eso reescribiría datos que nadie
 * tocó —el mismo error que ya está documentado en la hoja de ruta—. Acá vuelve
 * sólo lo que la persona eligió: el camión del día y la observación.
 */
type BorradorPlanilla = Record<string, { camion_id: string; observaciones: string }>;

function normalizarBorradorPlanilla(crudo: unknown): BorradorPlanilla | null {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;

  const out: BorradorPlanilla = {};
  for (const [choferId, v] of Object.entries(crudo as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const { camion_id, observaciones } = v as Record<string, unknown>;
    out[choferId] = {
      camion_id: typeof camion_id === "string" ? camion_id : "",
      observaciones: typeof observaciones === "string" ? observaciones : "",
    };
  }
  return Object.keys(out).length ? out : null;
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

  const [cambiosOpen, setCambiosOpen] = useState(false);
  const [soloCambios, setSoloCambios] = useState(false);
  const [soloSinCamion, setSoloSinCamion] = useState(false);
  const [busqueda, setBusqueda] = useState("");

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

  // ── Borrador: la planilla del día sobrevive a un F5 o a un corte.
  // La clave lleva la fecha: cada día es una planilla distinta y el borrador de
  // ayer no tiene por qué aparecer al abrir la de hoy.
  const filasOriginales = useMemo(() => new Map(buildFilas(data).map((f) => [f.chofer_id, f])), [data]);

  const valorBorrador = useMemo<BorradorPlanilla>(() => {
    const out: BorradorPlanilla = {};
    for (const f of filas) {
      const original = filasOriginales.get(f.chofer_id);
      if (!original) continue;
      if (f.camion_id !== original.camion_id || f.observaciones !== original.observaciones) {
        out[f.chofer_id] = { camion_id: f.camion_id, observaciones: f.observaciones };
      }
    }
    return out;
  }, [filas, filasOriginales]);

  const cantidadSinGuardar = Object.keys(valorBorrador).length;

  const borrador = useBorrador({
    pantalla: `viajes-planilla-diaria:${data.fecha}`,
    valor: valorBorrador,
    normalizar: normalizarBorradorPlanilla,
    hayDatos: (b) => Object.keys(b).length > 0,
    activo: editable,
  });

  useCambiosSinGuardar(editable && cantidadSinGuardar > 0);

  // ── En vivo: si otro guarda la planilla del día, esta pantalla se entera.
  //
  // El refresco es el del router: los datos de esta pantalla los arma el
  // servidor, así que vuelve a pedírselos y reconcilia. No recarga la página ni
  // pierde el scroll. Lo que NO hace por sí solo es rearmar la grilla —`filas`
  // se inicializa una sola vez—, y de eso se encarga el efecto de abajo.
  const { novedades, ver } = useNovedades({
    seccion: "planilla-diaria",
    recargar: () => router.refresh(),
    ocupado: cantidadSinGuardar > 0,
    activo: editable,
  });

  // Llegó una planilla nueva del servidor: se adopta SÓLO si no hay nada sin
  // guardar. Pisarle a alguien los camiones que acaba de asignar sería peor que
  // mostrarle datos de hace un minuto.
  const dataRef = useRef(data);
  useEffect(() => {
    if (dataRef.current === data) return;
    dataRef.current = data;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional: llegó una planilla nueva del servidor y no hay nada sin guardar
    if (cantidadSinGuardar === 0) setFilas(buildFilas(data));
  }, [data, cantidadSinGuardar]);

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    setFilas((prev) => prev.map((f) => (b[f.chofer_id] ? { ...f, ...b[f.chofer_id] } : f)));
  };

  /** Una fila cambió si el camión que tiene ahora no es el que traía. */
  const tieneCambio = (f: Fila) => f.camion_id !== f.camion_previo_id;

  const filasConCambio = useMemo(() => filas.filter(tieneCambio), [filas]);
  /** Choferes que hoy quedarían sin unidad: son los que no aparecen en la hoja de
   *  ruta ni pueden cargar viajes, así que se avisan arriba y se pueden aislar. */
  const filasSinCamion = useMemo(() => filas.filter((f) => !f.camion_id), [filas]);

  const filasVisibles = useMemo(() => {
    let out = filas;
    if (soloCambios) out = out.filter(tieneCambio);
    if (soloSinCamion) out = out.filter((f) => !f.camion_id);
    const q = normalizarParaBuscar(busqueda);
    if (q) {
      out = out.filter((f) => {
        const patente = f.camion_id ? patentePorCamion.get(f.camion_id) ?? "" : "";
        return normalizarParaBuscar(
          `${f.apellido} ${f.nombre} ${patente} ${f.camion_habitual_patente ?? ""}`,
        ).includes(q);
      });
    }
    return out;
  }, [filas, soloCambios, soloSinCamion, busqueda, patentePorCamion]);

  // Qué chofer(es) tienen cada camión hoy — para marcar ocupado/libre en el selector.
  const ocupadoPor = useMemo(() => {
    const m = new Map<string, { id: string; label: string }[]>();
    for (const f of filas) {
      if (!f.camion_id) continue;
      const arr = m.get(f.camion_id) ?? [];
      // Mismo formato que la columna Chofer ("Apellido, Nombre"): en el selector
      // hay que reconocer de quién se le está sacando el camión, y con dos Cejas
      // o dos Asteazarán el apellido solo no alcanza.
      arr.push({ id: f.chofer_id, label: nombreCompletoPersona(f.apellido, f.nombre) });
      m.set(f.camion_id, arr);
    }
    return m;
  }, [filas]);

  // Unidades activas que no le quedaron a nadie (pedido de Nico, 31/08). En la
  // grilla no se pueden ver: lista choferes, y un camión sin chofer no tiene fila
  // donde aparecer. Se recalcula con cada cambio del selector, así que mientras se
  // arma la planilla dice qué queda parado.
  const equiposSinChofer = useMemo(
    () => data.camiones.filter((c) => c.activo && !ocupadoPor.has(c.id)),
    [data.camiones, ocupadoPor],
  );
  const cantidadActivos = useMemo(
    () => data.camiones.filter((c) => c.activo).length,
    [data.camiones],
  );

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

  /** "AF671SI — Schwindt, Jorge y Cepeda, Tomas": qué unidad está repetida y entre
   *  quiénes. Decir sólo "hay un camión repetido" obligaba a buscarlo a ojo entre
   *  63 filas. */
  const detalleDuplicados = useMemo(
    () =>
      [...camionesDuplicados].map((camId) => ({
        patente: patentePorCamion.get(camId) ?? "sin patente",
        choferes: filas
          .filter((f) => f.camion_id === camId)
          .map((f) => nombreCompletoPersona(f.apellido, f.nombre)),
      })),
    [camionesDuplicados, patentePorCamion, filas],
  );

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
      setResultado({
        ok: false,
        mensaje: `Corregí antes de guardar: ${detalleDuplicados
          .map((d) => `${d.patente} está en ${d.choferes.join(" y ")}`)
          .join("; ")}.`,
      });
      return;
    }
    setGuardando(true);
    setResultado(null);

    // Mismo motivo que en la carga rápida: sin el try/finally, una acción que
    // tira dejaba el botón en "Guardando..." para siempre y sin decir nada.
    try {
      const res = await guardarPlanillaDiariaAction({
        fecha: data.fecha,
        items: filas.map((f) => ({
          chofer_id: f.chofer_id,
          camion_id: f.camion_id || null,
          observaciones: f.observaciones.trim() || null,
        })),
      });

      if (res.ok) {
        setResultado({
          ok: true,
          mensaje:
            res.cambios > 0
              ? `Planilla guardada: ${res.cambios} cambio(s) de camión sobre ${res.guardadas} chofer(es). Queda fijo hasta que lo cambies y el cambio queda registrado en el historial.`
              : `Planilla guardada: ${res.guardadas} chofer(es) con camión, sin cambios de unidad.`,
        });
        // Recién con el OK del servidor el borrador deja de hacer falta.
        borrador.limpiar();
        router.refresh();
      } else {
        setResultado({ ok: false, mensaje: res.error });
      }
    } catch (e) {
      setResultado({
        ok: false,
        mensaje:
          e instanceof Error && e.message
            ? `No se pudo guardar la planilla: ${e.message}. Los cambios siguen en pantalla, probá de nuevo.`
            : "No se pudo guardar la planilla. Los cambios siguen en pantalla, probá de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    // El botón flotante de guardar tapa el final de la grilla en el celular:
    // el padding de abajo deja pasar la última fila.
    <div className={`space-y-5 ${editable ? "pb-20 sm:pb-0" : ""}`}>
      <CambiosDrawer open={cambiosOpen} onClose={() => setCambiosOpen(false)} />

      <BarraNovedades
        cantidad={novedades}
        onVer={ver}
        sustantivo="cambio en la planilla"
        sustantivoPlural="cambios en la planilla"
      />

      {borrador.pendiente && (
        <AvisoBorrador
          ts={borrador.pendiente.ts}
          detalle={`${Object.keys(borrador.pendiente.valor).length} chofer(es)`}
          onRecuperar={recuperarBorrador}
          onDescartar={borrador.descartar}
        />
      )}

      {/* Barra superior: fecha + atajos */}
      <div className="bg-card border border-border rounded-[8px] p-4 sm:px-5 sm:py-4 flex flex-wrap items-end gap-3 sm:gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground block">Fecha</label>
          <CalendarioPopover
            value={data.fecha}
            onSelect={cambiarFecha}
            triggerLabel={fmtFecha(data.fecha)}
            ariaLabel="Elegir fecha de la planilla"
            maxDate={data.hoy}
            hoy={data.hoy}
            marca={(fecha) =>
              fechasConCambios.has(fecha)
                ? {
                    className:
                      "bg-amber-50 text-amber-700 hover:bg-amber-100/80 font-semibold border border-amber-300/70",
                    title: "Planilla guardada · hubo cambios de camión",
                  }
                : fechasGuardadas.has(fecha)
                  ? {
                      className:
                        "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 font-semibold border border-emerald-200/60",
                      title: "Planilla guardada",
                    }
                  : undefined
            }
            pie={() => (
              <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-50 border border-emerald-200/60" />
                  planilla guardada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-amber-50 border border-amber-300/70" />
                  hubo cambio de camión
                </span>
              </div>
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

        {/* Buscador: con 63 choferes, encontrar a uno era scrollear a ojo. */}
        <div className="w-full sm:w-auto sm:min-w-[240px] space-y-1">
          <label
            htmlFor="planilla-buscar"
            className="text-xs font-semibold text-muted-foreground block"
          >
            Buscar
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
            />
            <input
              id="planilla-buscar"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Chofer o patente..."
              // 16px en el celular: con menos, iOS hace zoom al enfocar el campo.
              className="h-10 sm:h-9 w-full sm:w-56 pl-8 pr-8 text-base sm:text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                title="Limpiar búsqueda"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Resumen del día, leído como frase: el color va en el número, no en un
            fondo. Los dos conteos son además el filtro — el número que te llama la
            atención es el que te lleva a esas filas. */}
        <div className="w-full lg:w-auto lg:self-center lg:ml-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground/80">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> libre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> ocupado
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>
            <strong className="font-semibold text-foreground">{asignados}</strong> de{" "}
            {filas.length} con camión
          </span>
          {filasSinCamion.length > 0 && (
            <button
              type="button"
              onClick={() => setSoloSinCamion((v) => !v)}
              title={
                soloSinCamion
                  ? "Ver todos los choferes"
                  : "Ver solo los choferes sin camión asignado"
              }
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-colors ${
                soloSinCamion
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="size-2 rounded-full bg-[#0088D1]" />
              <span>
                <strong className="font-semibold text-[#0088D1]">
                  {filasSinCamion.length}
                </strong>{" "}
                sin camión
              </span>
            </button>
          )}
          {(filasConCambio.length > 0 || soloCambios) && (
            <button
              type="button"
              onClick={() => setSoloCambios((v) => !v)}
              title={soloCambios ? "Ver todos los choferes" : "Ver solo los que cambiaron"}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border transition-colors ${
                soloCambios
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent hover:bg-muted hover:text-foreground"
              }`}
            >
              <Repeat2 size={12} className="text-amber-600" />
              <span>
                <strong className="font-semibold text-amber-700">
                  {filasConCambio.length}
                </strong>{" "}
                {filasConCambio.length === 1 ? "cambio" : "cambios"} de camión
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Ese día nunca se guardó planilla: no hay nada que comparar */}
      {!editable && data.hay_planilla === false && (
        <div className="flex flex-col sm:flex-row items-start gap-3 rounded-[8px] px-4 py-3 text-sm border bg-[#F8FAFC] border-border text-muted-foreground">
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
          <Button type="button" variant="outline" size="sm" onClick={irAHoy} className="gap-1.5 h-9 sm:h-8 text-xs shrink-0 w-full sm:w-auto">
            <CalendarClock size={13} /> Ir a hoy
          </Button>
        </div>
      )}

      {/* Aviso: fecha pasada = solo lectura (historial) */}
      {!editable && data.hay_planilla !== false && (
        <div className="flex flex-col sm:flex-row items-start gap-3 rounded-[8px] px-4 py-3 text-sm border bg-[#F8FAFC] border-border text-muted-foreground">
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
          <Button type="button" variant="outline" size="sm" onClick={irAHoy} className="gap-1.5 h-9 sm:h-8 text-xs shrink-0 w-full sm:w-auto">
            <CalendarClock size={13} /> Ir a hoy
          </Button>
        </div>
      )}

      {/* Camión repetido: en la planilla una unidad es de UN chofer por día (la
          base lo exige con un unique por fecha+camión), así que hay que decir cuál
          y entre quiénes, no sólo que "hay uno repetido". Bloquea el guardado, por
          eso es lo único que se anuncia con un cartel propio. */}
      {hayDuplicados && (
        <div className="flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border border-border bg-card">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {detalleDuplicados.length === 1
                ? "Hay un camión asignado a dos choferes."
                : `Hay ${detalleDuplicados.length} camiones asignados a más de un chofer.`}
            </p>
            <ul className="text-xs mt-1 space-y-0.5 text-muted-foreground">
              {detalleDuplicados.map((d) => (
                <li key={d.patente}>
                  <strong className="font-mono font-semibold text-red-600">
                    {d.patente}
                  </strong>{" "}
                  — {d.choferes.join(" y ")}
                </li>
              ))}
            </ul>
            <p className="text-xs mt-1.5 text-muted-foreground">
              En la planilla del día cada unidad va con un solo chofer. Si el camión
              se lo pasaron entre los dos, dejalo acá con el que lo tiene y cargá el
              viaje del otro desde <strong className="font-semibold">Carga rápida</strong>,
              que sí permite repetir la unidad.
            </p>
          </div>
        </div>
      )}

      {/* Grilla */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Camión del día", "Cambio", "Observaciones"].map((h, i) => (
                  <th
                    key={h}
                    // El chofer queda fijo a la izquierda: en el celular la
                    // grilla se scrollea de costado y sin él se pierde la
                    // referencia de a quién se le está poniendo el camión.
                    className={`px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs border-b border-border whitespace-nowrap ${
                      i === 0 ? "sticky left-0 z-20 bg-[#F9FBFC]" : ""
                    }`}
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
                    {/* Chofer — columna fija al scrollear de costado. El fondo
                        va sólido (no puede ser translúcido: se vería el
                        contenido pasando por debajo). */}
                    <td
                      className={`px-3 py-1.5 whitespace-nowrap sticky left-0 z-10 ${
                        duplicado ? "bg-[#FEF9F9]" : cambio ? "bg-[#FFFDF7]" : "bg-card"
                      }`}
                    >
                      <span className="font-medium text-foreground">
                        {nombreCompletoPersona(f.apellido, f.nombre)}
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
                          triggerClassName="h-9 sm:h-8 w-48 text-xs"
                        />
                        {esHabitual && !duplicado && (
                          <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
                            habitual
                          </span>
                        )}
                        {!esHabitual && !duplicado && (
                          <div className="flex flex-col gap-0.5">
                            {f.camion_id ? (
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
                                Reemplazo{" "}
                                {f.camion_habitual_patente && (
                                  <span className="font-medium normal-case tracking-normal text-muted-foreground/60">
                                    (habitual {f.camion_habitual_patente})
                                  </span>
                                )}
                              </span>
                            ) : (
                              // La fila sin unidad tenía que notarse ACÁ, no sólo en
                              // el conteo de arriba: entre 62 filas, el hueco donde
                              // las demás dicen "habitual" se leía como fila a medio
                              // llenar, no como chofer sin camión.
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#0088D1] uppercase tracking-wide whitespace-nowrap">
                                <span className="size-1.5 rounded-full bg-[#0088D1] shrink-0" />
                                Sin camión
                                {f.camion_habitual_patente && (
                                  <span className="font-medium normal-case tracking-normal text-muted-foreground/60">
                                    (habitual {f.camion_habitual_patente})
                                  </span>
                                )}
                              </span>
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
                        className="h-9 sm:h-8 w-full min-w-[220px] px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              })}
              {filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {busqueda.trim()
                      ? `Ningún chofer ni patente coincide con "${busqueda.trim()}".`
                      : soloSinCamion
                        ? "Todos los choferes tienen camión asignado."
                        : soloCambios
                          ? "No hubo cambios de camión."
                          : "No hay choferes activos."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipos sin chofer — al pie de la grilla, que es donde se termina de
          armar el día: "¿qué unidad queda libre?" es la pregunta siguiente. */}
      <section
        aria-labelledby="equipos-sin-chofer"
        className="bg-card border border-border rounded-[8px] px-4 py-3"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2
            id="equipos-sin-chofer"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Equipos sin chofer
          </h2>
          <span className="text-xs text-muted-foreground/70">
            {equiposSinChofer.length > 0 ? (
              <>
                <strong className="font-semibold text-foreground">
                  {equiposSinChofer.length}
                </strong>{" "}
                de {cantidadActivos} unidades activas {editable ? "quedan" : "quedaron"} sin
                chofer {editable ? "hoy" : "ese día"}
              </>
            ) : (
              <>Las {cantidadActivos} unidades activas tienen chofer asignado.</>
            )}
          </span>
        </div>

        {equiposSinChofer.length > 0 && (
          <ul className="mt-2 grid gap-x-6 gap-y-1 max-h-48 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {equiposSinChofer.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 text-xs">
                <span className="font-mono font-semibold text-foreground">{c.label}</span>
                <span className="text-muted-foreground/70 truncate">
                  {c.acoplado ? `· ${c.acoplado}` : "· sin semi"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      {/* Qué hay sin guardar y desde cuándo está a salvo. El botón es flotante,
          así que esto va al pie de la grilla, que es donde se termina de cargar. */}
      {editable && cantidadSinGuardar > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {cantidadSinGuardar} chofer{cantidadSinGuardar !== 1 ? "es" : ""} sin guardar.
          </span>
          <SelloBorrador ts={borrador.guardadoTs} />
        </div>
      )}

      {/* Guardar (Flotante) */}
      {editable && (
        <div className="fixed inset-x-4 bottom-4 pb-safe sm:inset-x-auto sm:right-6 sm:bottom-6 z-50">
          <Button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || hayDuplicados}
            className="w-full sm:w-auto bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold px-6 h-11 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
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
