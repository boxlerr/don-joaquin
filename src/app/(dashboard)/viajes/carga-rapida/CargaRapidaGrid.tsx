"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import {
  createViajesBatchAction,
  type ViajeFormData,
  type ViajeFilaRapida,
} from "../actions";
import { useBorrador } from "@/hooks/useBorrador";
import { useCambiosSinGuardar } from "@/hooks/useCambiosSinGuardar";
import AvisoBorrador, { SelloBorrador } from "@/components/borradores/AvisoBorrador";

// ── Tipos internos ────────────────────────────────────────────────────────────

type Fila = {
  id: number;
  fecha_viaje: string;
  chofer_id: string;
  camion_id: string;
  ruta_id: string;
  origen_nombre: string;
  destino_nombre: string;
  km_con_carga: string;
  km_vacios: string;
  /** Vía del viaje: "" (sin marcar) · ruta_5 (directa) · ruta_22 (por la base). */
  ruta_via: string;
  tonelaje_real: string;
  monto_flete: string;
  /** Tarifa que precargó el monto (snapshot). Vacío = cargado a mano. */
  tarifa_id: string;
  nro_viaje_ypf: string;
  es_vacio: boolean;
};

let nextId = 1;

const HOY = new Date().toISOString().slice(0, 10);

function filaVacia(overrides?: Partial<Fila>): Fila {
  return {
    id: nextId++,
    fecha_viaje: HOY,
    chofer_id: "",
    camion_id: "",
    ruta_id: "",
    origen_nombre: "",
    destino_nombre: "",
    km_con_carga: "0",
    km_vacios: "0",
    ruta_via: "",
    tonelaje_real: "0",
    monto_flete: "0",
    tarifa_id: "",
    nro_viaje_ypf: "",
    es_vacio: false,
    ...overrides,
  };
}

// ── Borrador ──────────────────────────────────────────────────────────────────

/**
 * Lo que se está cargando, tal como se guarda en el navegador.
 *
 * Esta pantalla es la que más duele perder: son veinte filas tipeadas a mano
 * que hasta que no se toca Guardar viven sólo en memoria. Un F5 sin querer, un
 * corte de luz o cerrar la pestaña las borraba todas.
 *
 * El `id` de fila no se guarda: es un contador de la sesión, y al recuperar se
 * asignan ids nuevos. Guardarlo traía filas con id repetido —dos filas que se
 * editaban juntas— apenas se agregaba una más.
 */
type BorradorCarga = {
  filas: Omit<Fila, "id">[];
  clienteId: string;
  tipoCargaId: string;
};

/** La fila sin su `id`: el id es un contador de la sesión, no un dato cargado. */
function sinId(f: Fila): Omit<Fila, "id"> {
  const copia: Partial<Fila> = { ...f };
  delete copia.id;
  return copia as Omit<Fila, "id">;
}

const FILA_REFERENCIA: Omit<Fila, "id"> = sinId(filaVacia());

/** Si esto da `false` la fila está como salió de fábrica: no hay nada que salvar. */
function filaTieneDatos(f: Omit<Fila, "id">): boolean {
  return (
    f.chofer_id !== "" ||
    f.camion_id !== "" ||
    f.ruta_id !== "" ||
    f.origen_nombre.trim() !== "" ||
    f.destino_nombre.trim() !== "" ||
    f.nro_viaje_ypf.trim() !== "" ||
    f.ruta_via !== "" ||
    f.es_vacio ||
    f.fecha_viaje !== FILA_REFERENCIA.fecha_viaje ||
    f.km_con_carga !== FILA_REFERENCIA.km_con_carga ||
    f.km_vacios !== FILA_REFERENCIA.km_vacios ||
    f.tonelaje_real !== FILA_REFERENCIA.tonelaje_real ||
    f.monto_flete !== FILA_REFERENCIA.monto_flete
  );
}

function normalizarBorrador(crudo: unknown): BorradorCarga | null {
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;
  const c = crudo as Partial<BorradorCarga>;
  if (!Array.isArray(c.filas) || c.filas.length === 0) return null;
  if (c.filas.some((f) => !f || typeof f !== "object" || Array.isArray(f))) return null;

  return {
    // Contra la fila de fábrica: un borrador guardado antes de que la grilla
    // tuviera una columna nueva no puede romper la pantalla al volver.
    filas: c.filas.map((f) => ({ ...FILA_REFERENCIA, ...(f as Partial<Omit<Fila, "id">>) })),
    clienteId: typeof c.clienteId === "string" ? c.clienteId : "",
    tipoCargaId: typeof c.tipoCargaId === "string" ? c.tipoCargaId : "",
  };
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function CargaRapidaGrid({ data }: { data: ViajeFormData }) {
  const router = useRouter();

  // Selectores globales (aplican a todas las filas por defecto)
  const [globalClienteId, setGlobalClienteId] = useState("");
  const [globalTipoCargaId, setGlobalTipoCargaId] = useState(
    data.tipos_carga[0]?.id ?? "",
  );

  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; creados?: number; mensaje: string } | null>(null);
  const [erroresValidacion, setErroresValidacion] = useState<{ fila: number; mensaje: string }[]>([]);

  // ── Borrador: lo cargado sobrevive a un F5, a un corte de luz y a cerrar sin querer.
  const valorBorrador = useMemo<BorradorCarga>(
    () => ({
      filas: filas.map(sinId),
      clienteId: globalClienteId,
      tipoCargaId: globalTipoCargaId,
    }),
    [filas, globalClienteId, globalTipoCargaId],
  );

  const borrador = useBorrador({
    pantalla: "viajes-carga-rapida",
    valor: valorBorrador,
    normalizar: normalizarBorrador,
    hayDatos: (b) => b.filas.some(filaTieneDatos),
  });

  const hayCargaSinGuardar = valorBorrador.filas.some(filaTieneDatos);
  useCambiosSinGuardar(hayCargaSinGuardar);

  const recuperarBorrador = () => {
    const b = borrador.recuperar();
    if (!b) return;
    // `filaVacia` asigna un id nuevo a cada fila y le aplica encima lo guardado.
    setFilas(b.filas.map((f) => filaVacia(f)));
    if (b.clienteId) setGlobalClienteId(b.clienteId);
    if (b.tipoCargaId) setGlobalTipoCargaId(b.tipoCargaId);
  };

  // Mapa chofer_id → camion_id para auto-completar
  const camionPorChofer = new Map<string, string>(
    data.choferes
      .filter((c) => c.camionId)
      .map((c) => [c.id, c.camionId!]),
  );

  const nombreCamion = useMemo(
    () => new Map(data.camiones.map((c) => [c.id, c.label])),
    [data.camiones],
  );
  const nombreChofer = useMemo(
    () => new Map(data.choferes.map((c) => [c.id, c.label])),
    [data.choferes],
  );

  // Un mismo camión en dos filas es válido (el chofer llega y se lo pasa a otro),
  // pero casi siempre es que se duplicó una fila y se cambió el chofer sin que el
  // autocompletado pisara el camión —porque ese chofer no tiene unidad fija—. Se
  // permite guardar; sólo se marca para que no pase de largo.
  const camionesRepetidos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const f of filas) {
      if (f.camion_id) cuenta.set(f.camion_id, (cuenta.get(f.camion_id) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [filas]);

  const detalleRepetidos = useMemo(
    () =>
      [...camionesRepetidos].map((camId) => ({
        patente: nombreCamion.get(camId) ?? "sin patente",
        choferes: filas
          .filter((f) => f.camion_id === camId)
          .map((f) => nombreChofer.get(f.chofer_id) ?? "sin chofer"),
      })),
    [camionesRepetidos, filas, nombreCamion, nombreChofer],
  );

  const actualizarFila = useCallback(
    (id: number, campo: keyof Fila, valor: string) => {
      setFilas((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const updated = { ...f, [campo]: valor };
          // Auto-completar camión al cambiar chofer
          if (campo === "chofer_id" && camionPorChofer.has(valor)) {
            updated.camion_id = camionPorChofer.get(valor)!;
          }
          // Editar a mano el monto o la ruta/tonelaje invalida el snapshot de tarifa.
          if (
            campo === "monto_flete" ||
            campo === "origen_nombre" ||
            campo === "destino_nombre" ||
            campo === "tonelaje_real"
          ) {
            updated.tarifa_id = "";
          }
          return updated;
        }),
      );
    },
    [camionPorChofer],
  );

  // Al elegir un circuito en una fila: autocompletar origen, destino y km.
  const aplicarCircuito = useCallback(
    (id: number, circuitoId: string) => {
      const c = data.circuitos.find((x) => x.id === circuitoId);
      setFilas((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          if (!c) return { ...f, ruta_id: circuitoId };
          // La distancia del circuito es una sola: va a km con carga si la fila
          // es cargada, o a km vacíos si es vacía (un viaje = un tramo, nunca ambos).
          const dist = String(c.km_con_carga || c.km_vacios);
          return {
            ...f,
            ruta_id: circuitoId,
            origen_nombre: c.origen === "—" ? "" : c.origen,
            destino_nombre: c.destino === "—" ? "" : c.destino,
            km_con_carga: f.es_vacio ? "0" : dist,
            km_vacios: f.es_vacio ? dist : "0",
            // Cambió la ruta: la tarifa que estaba puesta ya no corresponde.
            tarifa_id: "",
          };
        }),
      );
    },
    [data.circuitos],
  );

  const agregarFila = () => setFilas((prev) => [...prev, filaVacia()]);

  const eliminarFila = (id: number) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));

  const duplicarFila = (id: number) => {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const copia = { ...prev[idx], id: nextId++, nro_viaje_ypf: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, copia);
      return next;
    });
  };

  const toggleVacio = (id: number) =>
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, es_vacio: !f.es_vacio } : f)),
    );

  // Inserta debajo una fila de "vuelta": origen/destino invertidos, marcada como
  // vacía (caso típico de la vuelta) con la distancia movida a km vacíos. Si la
  // vuelta vino cargada, se destilda "Vacío" y se completan monto/tonelaje.
  const agregarVuelta = (id: number) => {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const o = prev[idx];
      const vuelta = filaVacia({
        fecha_viaje: o.fecha_viaje,
        chofer_id: o.chofer_id,
        camion_id: o.camion_id,
        origen_nombre: o.destino_nombre,
        destino_nombre: o.origen_nombre,
        km_con_carga: "0",
        km_vacios: o.km_con_carga !== "0" ? o.km_con_carga : o.km_vacios,
        // La vuelta se lleva la distancia de la ida, y esa distancia depende de
        // la vía: sin copiarla también, la vuelta se guardaba "Sin marcar" con
        // los km de una Ruta 5/22 y ensuciaba el historial del par.
        ruta_via: o.ruta_via,
        es_vacio: true,
      });
      const next = [...prev];
      next.splice(idx + 1, 0, vuelta);
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!globalClienteId) {
      setResultado({ ok: false, mensaje: "Seleccioná un cliente global antes de guardar." });
      return;
    }
    if (!globalTipoCargaId) {
      setResultado({ ok: false, mensaje: "Seleccioná un tipo de carga global antes de guardar." });
      return;
    }

    const payload: ViajeFilaRapida[] = filas.map((f) => ({
      fecha_viaje: f.fecha_viaje,
      cliente_id: globalClienteId,
      chofer_id: f.chofer_id,
      camion_id: f.camion_id,
      tipo_carga_id: globalTipoCargaId,
      ruta_id: f.ruta_id || null,
      origen_nombre: f.origen_nombre.trim() || null,
      destino_nombre: f.destino_nombre.trim() || null,
      km_con_carga: Number(f.km_con_carga) || 0,
      km_vacios: Number(f.km_vacios) || 0,
      ruta_via: (f.ruta_via || null) as ViajeFilaRapida["ruta_via"],
      tonelaje_real: Number(f.tonelaje_real) || 0,
      monto_flete: Number(f.monto_flete) || 0,
      tarifa_id: f.tarifa_id || null,
      nro_viaje_ypf: f.nro_viaje_ypf.trim() || null,
      es_vacio: f.es_vacio,
    }));

    setGuardando(true);
    setResultado(null);
    setErroresValidacion([]);

    // El try/finally no es decorativo: si la acción del servidor tira (permisos,
    // un lugar que no se pudo dar de alta, se cortó la red), el `await` levanta
    // la excepción y sin esto el `setGuardando(false)` nunca corría. El botón
    // se quedaba en "Guardando..." para siempre, sin guardar nada y sin decirlo.
    try {
      const res = await createViajesBatchAction(payload);

      if (res.ok) {
        setResultado({ ok: true, creados: res.creados, mensaje: `${res.creados} viaje(s) creados correctamente.` });
        // Limpiar filas y dejar una nueva lista para seguir cargando
        setFilas([filaVacia()]);
        // El borrador se tira recién acá: si el guardado falla, las filas
        // siguen estando y el borrador con ellas.
        borrador.limpiar();
        router.refresh();
      } else {
        if (res.errores?.length) {
          setErroresValidacion(res.errores);
        }
        setResultado({ ok: false, mensaje: res.error ?? "Error al guardar los viajes." });
      }
    } catch (e) {
      setResultado({
        ok: false,
        mensaje:
          e instanceof Error && e.message
            ? `No se pudieron guardar los viajes: ${e.message}. Las filas quedaron cargadas, probá de nuevo.`
            : "No se pudieron guardar los viajes. Las filas quedaron cargadas, probá de nuevo.",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5">
      {borrador.pendiente && (
        <AvisoBorrador
          ts={borrador.pendiente.ts}
          detalle={`${borrador.pendiente.valor.filas.length} fila${
            borrador.pendiente.valor.filas.length !== 1 ? "s" : ""
          }`}
          onRecuperar={recuperarBorrador}
          onDescartar={borrador.descartar}
        />
      )}

      {/* Selectores globales */}
      <div className="bg-card border border-border rounded-[8px] p-4 sm:px-5 sm:py-4 flex flex-wrap items-end gap-3 sm:gap-4">
        <div className="space-y-1 w-full sm:w-auto sm:min-w-[220px]">
          <label className="text-xs font-semibold text-muted-foreground">
            Cliente <span className="text-red-500">*</span>
          </label>
          <Combobox
            value={globalClienteId}
            onValueChange={setGlobalClienteId}
            options={data.clientes}
            placeholder="Seleccioná un cliente..."
            searchPlaceholder="Buscar cliente..."
            triggerClassName="h-10 sm:h-9"
          />
        </div>

        <div className="space-y-1 w-full sm:w-auto sm:min-w-[180px]">
          <label className="text-xs font-semibold text-muted-foreground">
            Tipo de carga <span className="text-red-500">*</span>
          </label>
          <Combobox
            value={globalTipoCargaId}
            onValueChange={setGlobalTipoCargaId}
            options={data.tipos_carga}
            placeholder="Seleccioná..."
            searchable={false}
            triggerClassName="h-10 sm:h-9"
          />
        </div>

        <p className="text-xs text-muted-foreground/80 self-center">
          Aplican a todas las filas. Podés cambiarlos por fila directamente en la tabla.
        </p>
      </div>

      {/* Datalist puntos de ruta */}
      <datalist id="carga-rapida-puntos">
        {data.puntos_ruta.map((p) => (
          <option key={p.id} value={p.label} />
        ))}
      </datalist>

      {/* Grilla */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {[
                  "Fecha",
                  "Chofer",
                  "Camión",
                  ...(data.circuitos.length > 0 ? ["Circuito"] : []),
                  "Origen",
                  "Destino",
                  "Vía",
                  "KM carga",
                  "KM vacíos",
                  "Tonelaje",
                  "$ Flete",
                  "Vacío",
                  "Nº viaje",
                  "",
                ].map((h, i) => (
                  <th
                    key={h}
                    // La fecha queda fija a la izquierda: en el celular la grilla
                    // se scrollea de costado y sin ella se pierde de qué fila es.
                    className={`px-2 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap ${
                      i === 0 ? "sticky left-0 z-20 bg-[#F9FBFC]" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => {
                const filaError = erroresValidacion.find((e) => e.fila === idx + 1);
                const camionRepetido = !!fila.camion_id && camionesRepetidos.has(fila.camion_id);
                return (
                  <tr
                    key={fila.id}
                    className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${filaError ? "bg-red-50/50" : ""}`}
                  >
                    {/* Fecha — columna fija al scrollear de costado */}
                    <td
                      className={`px-1 py-1 sticky left-0 z-10 ${
                        filaError ? "bg-[#FEF9F9]" : "bg-card"
                      }`}
                    >
                      <input
                        type="date"
                        value={fila.fecha_viaje}
                        onChange={(e) => actualizarFila(fila.id, "fecha_viaje", e.target.value)}
                        className="h-9 sm:h-8 w-36 sm:w-32 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Chofer */}
                    <td className="px-1 py-1">
                      <Combobox
                        value={fila.chofer_id}
                        onValueChange={(v) => actualizarFila(fila.id, "chofer_id", v)}
                        options={data.choferes}
                        placeholder="— Elegí —"
                        searchPlaceholder="Buscar chofer..."
                        triggerClassName={`h-9 sm:h-8 w-40 text-xs ${!fila.chofer_id ? "border-amber-300" : ""}`}
                      />
                    </td>

                    {/* Camión */}
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <Combobox
                          value={fila.camion_id}
                          onValueChange={(v) => actualizarFila(fila.id, "camion_id", v)}
                          options={data.camiones}
                          placeholder="— Elegí —"
                          searchPlaceholder="Buscar patente..."
                          triggerClassName={`h-9 sm:h-8 w-32 text-xs ${
                            !fila.camion_id || camionRepetido ? "border-amber-300" : ""
                          }`}
                        />
                        {camionRepetido && (
                          <span
                            title={`${nombreCamion.get(fila.camion_id) ?? "Este camión"} está en más de una fila. Se puede guardar igual (si el camión se lo pasaron entre choferes), pero revisá que sea así.`}
                          >
                            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Circuito (autocompleta origen/destino/km) */}
                    {data.circuitos.length > 0 && (
                      <td className="px-1 py-1">
                        <Combobox
                          value={fila.ruta_id}
                          onValueChange={(v) => aplicarCircuito(fila.id, v)}
                          options={data.circuitos.map((c) => ({ id: c.id, label: c.label }))}
                          placeholder="— Opcional —"
                          searchPlaceholder="Buscar circuito..."
                          clearable
                          triggerClassName="h-9 sm:h-8 w-44 text-xs"
                        />
                      </td>
                    )}

                    {/* Origen */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.origen_nombre}
                        onChange={(e) => actualizarFila(fila.id, "origen_nombre", e.target.value)}
                        placeholder="Origen..."
                        list="carga-rapida-puntos"
                        className="h-9 sm:h-8 w-32 sm:w-28 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Destino */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.destino_nombre}
                        onChange={(e) => actualizarFila(fila.id, "destino_nombre", e.target.value)}
                        placeholder="Destino..."
                        list="carga-rapida-puntos"
                        className="h-9 sm:h-8 w-32 sm:w-28 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Vía: Ruta 5 (directa) vs Ruta 22 (por la base) — cambia los km */}
                    <td className="px-1 py-1">
                      <select
                        value={fila.ruta_via}
                        onChange={(e) => actualizarFila(fila.id, "ruta_via", e.target.value)}
                        title="¿Por qué ruta fue? Ruta 5 = directa (más corta) · Ruta 22 = por la base/zona"
                        className="h-9 sm:h-8 w-[92px] sm:w-[76px] px-1 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      >
                        <option value="">—</option>
                        <option value="ruta_5">Ruta 5</option>
                        <option value="ruta_22">Ruta 22</option>
                      </select>
                    </td>

                    {/* KM carga */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.km_con_carga}
                        onChange={(e) => actualizarFila(fila.id, "km_con_carga", e.target.value)}
                        min="0"
                        className="h-9 sm:h-8 w-24 sm:w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* KM vacíos */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.km_vacios}
                        onChange={(e) => actualizarFila(fila.id, "km_vacios", e.target.value)}
                        min="0"
                        className="h-9 sm:h-8 w-24 sm:w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Tonelaje */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.es_vacio ? "0" : fila.tonelaje_real}
                        onChange={(e) => actualizarFila(fila.id, "tonelaje_real", e.target.value)}
                        disabled={fila.es_vacio}
                        min="0"
                        step="0.01"
                        className="h-9 sm:h-8 w-24 sm:w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] disabled:opacity-40 disabled:bg-muted/40"
                      />
                    </td>

                    {/* Monto flete */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.es_vacio ? "0" : fila.monto_flete}
                        onChange={(e) => actualizarFila(fila.id, "monto_flete", e.target.value)}
                        disabled={fila.es_vacio}
                        min="0"
                        className="h-9 sm:h-8 w-28 sm:w-24 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] disabled:opacity-40 disabled:bg-muted/40"
                      />
                    </td>

                    {/* Vacío (vuelta sin carga): no factura ni suma tonelaje */}
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={fila.es_vacio}
                        onChange={() => toggleVacio(fila.id)}
                        title="Marcar como tramo vacío"
                        className="size-5 sm:size-4 rounded accent-[#0088D1] align-middle"
                      />
                    </td>

                    {/* Nº viaje */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.nro_viaje_ypf}
                        onChange={(e) => actualizarFila(fila.id, "nro_viaje_ypf", e.target.value)}
                        placeholder="Opcional"
                        maxLength={60}
                        className="h-9 sm:h-8 w-28 sm:w-24 px-2 text-xs rounded border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Acciones fila */}
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Agregar viaje de vuelta (origen/destino invertidos, vacío)"
                          onClick={() => agregarVuelta(fila.id)}
                          className="size-9 sm:size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-[#0088D1] hover:bg-[#E1F5FE] transition-colors"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          type="button"
                          title="Duplicar fila"
                          onClick={() => duplicarFila(fila.id)}
                          className="size-9 sm:size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          title="Eliminar fila"
                          onClick={() => eliminarFila(fila.id)}
                          disabled={filas.length === 1}
                          className="size-9 sm:size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                        {filaError && (
                          <span title={filaError.mensaje}>
                            <AlertTriangle size={13} className="text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer de la grilla */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={agregarFila}
            className="gap-1.5 h-9 sm:h-8 text-xs"
          >
            <Plus size={13} /> Agregar fila
          </Button>
          <span className="text-xs text-muted-foreground/80">
            {filas.length} fila{filas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Camión repetido entre filas: se avisa, no se bloquea. */}
      {detalleRepetidos.length > 0 && (
        <div className="flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border border-border bg-card">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {detalleRepetidos.length === 1
                ? "Hay un camión repetido en dos filas."
                : `Hay ${detalleRepetidos.length} camiones repetidos en más de una fila.`}
            </p>
            <ul className="text-xs mt-1 space-y-0.5 text-muted-foreground">
              {detalleRepetidos.map((d) => (
                <li key={d.patente}>
                  <strong className="font-mono font-semibold text-amber-600">
                    {d.patente}
                  </strong>{" "}
                  — {d.choferes.join(" y ")}
                </li>
              ))}
            </ul>
            <p className="text-xs mt-1.5 text-muted-foreground">
              Se puede guardar así: pasa cuando un chofer llega y le deja la unidad a
              otro. Ojo si no fue el caso — al duplicar una fila, el camión no se
              cambia solo cuando el chofer nuevo no tiene unidad fija.
            </p>
          </div>
        </div>
      )}

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

      {erroresValidacion.length > 0 && (
        <ul className="text-xs text-red-600 space-y-0.5 pl-4 list-disc">
          {erroresValidacion.map((e) => (
            <li key={e.fila}>
              <strong>Fila {e.fila}:</strong> {e.mensaje}
            </li>
          ))}
        </ul>
      )}

      {/* Acciones */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
        {/* El sello va con las acciones y no arriba: es acá donde alguien duda
            de si puede levantarse de la silla sin perder lo cargado. */}
        <div className="sm:mr-auto">
          <SelloBorrador ts={borrador.guardadoTs} />
        </div>
        <Button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold px-8 h-10 gap-2 w-full sm:w-auto"
        >
          {guardando ? (
            <><Loader2 size={15} className="animate-spin" /> Guardando...</>
          ) : (
            <><CheckCircle2 size={15} /> Guardar {filas.length} viaje{filas.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}
