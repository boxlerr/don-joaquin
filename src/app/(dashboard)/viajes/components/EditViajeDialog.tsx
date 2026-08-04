"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Calendar,
  User,
  LifeBuoy,
  Truck,
  Package,
  MapPin,
  Flag,
  Navigation,
  Scale,
  DollarSign,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  Hash,
  Route,
} from "lucide-react";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { Combobox } from "@/components/ui/combobox";
import { PlaceCombobox } from "@/components/ui/place-combobox";

const FIELD_COMBO_TRIGGER =
  "h-full border-0 rounded-none bg-transparent hover:bg-transparent focus-visible:ring-0";

// Vías con distancia propia: la Ruta 5 va derecho (más corta) y la Ruta 22 pasa
// por la base/zona. Mismas etiquetas que en Nuevo viaje.
const VIA_LABEL: Record<"ruta_5" | "ruta_22", string> = {
  ruta_5: "Ruta 5",
  ruta_22: "Ruta 22",
};
import {
  getViajeParaEditarAction,
  getViajeFormData,
  getImporteSugeridoAction,
  getKmHistoricoAction,
  updateViajeAction,
  type ViajeFormData,
} from "../actions";
import type { ViajeBasico } from "../types";
import { viajeEstaFacturado } from "@/domain/viajes/facturado";

interface Props {
  viaje: ViajeBasico;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (patch: Partial<ViajeBasico>) => void;
}

export default function EditViajeDialog({ viaje, open, onOpenChange, onSuccess }: Props) {
  const [loadingData, setLoadingData] = useState(false);
  const [formOptions, setFormOptions] = useState<ViajeFormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fechaViaje, setFechaViaje] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [camionId, setCamionId] = useState("");
  const [tipoCargaId, setTipoCargaId] = useState("");
  const [rutaId, setRutaId] = useState("");
  const [descripcionOtros, setDescripcionOtros] = useState("");
  const [origenNombre, setOrigenNombre] = useState("");
  const [destinoNombre, setDestinoNombre] = useState("");
  const [kmConCarga, setKmConCarga] = useState("0");
  const [kmVacios, setKmVacios] = useState("0");
  // Vía del viaje (Ruta 5 directa / Ruta 22 por la base): define los km del par.
  const [rutaVia, setRutaVia] = useState<"" | "ruta_5" | "ruta_22">("");
  const [tonelaje, setTonelaje] = useState("0");
  const [montoFlete, setMontoFlete] = useState("0");
  const [tarifaId, setTarifaId] = useState("");
  const [importeHint, setImporteHint] = useState<string | null>(null);
  const [nroViajeYpf, setNroViajeYpf] = useState("");
  const [material, setMaterial] = useState("");
  const [kmHistHint, setKmHistHint] = useState<string | null>(null);
  // Tramo vacío (la vuelta sin carga). Define en qué columna van los km y que el
  // viaje no factura. Sin este campo, un viaje cargado por error como vacío no
  // se podía corregir desde ningún lado.
  const [esVacio, setEsVacio] = useState(false);

  // El monto cargado es la fuente de verdad al abrir: solo recalculamos por
  // tarifa si el operador CAMBIA cliente/destino/tonelaje (routeTouched) y no
  // editó el monto a mano (montoDirty). Así abrir a editar otra cosa no lo pisa.
  const montoDirty = useRef(false);
  const routeTouched = useRef(false);

  // Los km cargados también son fuente de verdad al abrir: solo se recalculan si
  // el operador CAMBIA la ruta (par origen→destino o vía) y no los editó a mano.
  // `parOriginal` guarda el par y los km con los que se abrió, para saber si la
  // ruta realmente cambió y para poder restaurarlos si vuelve a la de antes.
  const kmDirty = useRef(false);
  const kmReqSeq = useRef(0);
  const parOriginal = useRef({ o: "", d: "", via: "", km: "0", kmv: "0" });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    setLoadingData(true);
    setLoadError(null);
    setError(null);
    setFieldErrors({});
    montoDirty.current = false;
    routeTouched.current = false;
    kmDirty.current = false;
    kmReqSeq.current++;
    setImporteHint(null);
    setKmHistHint(null);

    Promise.all([
      getViajeParaEditarAction(viaje.id),
      getViajeFormData(),
    ]).then(([vd, fd]) => {
      if ("error" in vd) { setLoadError(vd.error); return; }
      if ("error" in fd) { setLoadError(fd.error); return; }

      setFormOptions(fd);
      setFechaViaje(vd.fecha_viaje);
      setClienteId(vd.cliente_id);
      setChoferId(vd.chofer_id);
      setCamionId(vd.camion_id);
      setTipoCargaId(vd.tipo_carga_id);
      setRutaId(vd.ruta_id ?? "");
      setDescripcionOtros(vd.descripcion_otros ?? "");
      setOrigenNombre(vd.origen_nombre ?? "");
      setDestinoNombre(vd.destino_nombre ?? "");
      setKmConCarga(String(vd.km_con_carga));
      setKmVacios(String(vd.km_vacios));
      setRutaVia(vd.ruta_via ?? "");
      setTonelaje(String(vd.tonelaje_real));
      setMontoFlete(String(vd.monto_flete));
      setTarifaId(vd.tarifa_id ?? "");
      setNroViajeYpf(vd.nro_viaje_ypf ?? "");
      setMaterial(vd.material ?? "");
      setEsVacio(vd.es_vacio);
      parOriginal.current = {
        o: (vd.origen_nombre ?? "").trim().toLowerCase(),
        d: (vd.destino_nombre ?? "").trim().toLowerCase(),
        via: vd.ruta_via ?? "",
        km: String(vd.km_con_carga),
        kmv: String(vd.km_vacios),
      };
    }).finally(() => setLoadingData(false));
  }, [open, viaje.id]);

  // Edición manual del monto: la tarifa no lo pisa y deja de atribuirse a una tarifa.
  const handleMontoManual = (v: string) => {
    montoDirty.current = true;
    setImporteHint(null);
    setTarifaId("");
    setMontoFlete(v);
  };

  // Recalcular el monto desde la tarifa del destino, SOLO si el operador cambió
  // cliente/destino/tonelaje (routeTouched) y no editó el monto a mano. Igual que
  // en el alta: toneladas × precio del destino. Debounce para no spamear el server.
  useEffect(() => {
    if (!routeTouched.current || montoDirty.current) return;
    if (!clienteId || !destinoNombre.trim()) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await getImporteSugeridoAction(
        clienteId,
        origenNombre.trim() || null,
        destinoNombre.trim() || null,
        Number(tonelaje) || 0,
        Number(kmConCarga) || 0,
        fechaViaje || null,
      );
      if (cancelado || montoDirty.current) return;
      if (!res) {
        setImporteHint(null);
        setTarifaId("");
        return;
      }
      setMontoFlete(String(res.importe));
      setTarifaId(res.tarifaId);
      setImporteHint(`Importe recalculado por tarifa (${res.detalle}). Editá si fue distinto.`);
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [clienteId, origenNombre, destinoNombre, tonelaje, kmConCarga, fechaViaje]);

  // ── Km por historial ───────────────────────────────────────────────────────
  // Cambiar el destino cambia la ruta, así que los km del destino viejo dejan de
  // valer. Misma lógica que en Nuevo viaje: se traen los km del último viaje del
  // par (y de esa vía, si está marcada).
  //  - authoritative=true  (elegir del desplegable o cambiar la vía): recalcula
  //    al instante y pisa lo que haya.
  //  - authoritative=false (al tipear): solo si nadie tocó los km a mano.
  // En los dos casos, volver al par con el que se abrió el viaje restaura los km
  // guardados: editar otra cosa nunca los toca.
  const rutaCambio = (o: string, d: string, via: string) =>
    o.trim().toLowerCase() !== parOriginal.current.o ||
    d.trim().toLowerCase() !== parOriginal.current.d ||
    via !== parOriginal.current.via;

  /** La distancia del tramo, al campo que corresponde: cargado o vacío, nunca los dos. */
  const ponerKm = (distancia: number, vacio: boolean) => {
    setKmConCarga(vacio ? "0" : String(distancia));
    setKmVacios(vacio ? String(distancia) : "0");
  };

  const applyKmHistorico = async (
    o: string,
    d: string,
    authoritative: boolean,
    via: "" | "ruta_5" | "ruta_22" = rutaVia,
  ) => {
    const oo = o.trim();
    const dd = d.trim();
    const seq = ++kmReqSeq.current;

    // Volvió a la ruta original: los km que ya tenía el viaje son los correctos.
    if (!rutaCambio(oo, dd, via)) {
      if (!kmDirty.current) {
        setKmConCarga(parOriginal.current.km);
        setKmVacios(parOriginal.current.kmv);
      }
      setKmHistHint(null);
      return;
    }

    if (!oo || !dd || oo === "—" || dd === "—") {
      setKmHistHint(null);
      return;
    }
    if (!authoritative && kmDirty.current) return;

    const res = await getKmHistoricoAction(oo, dd, via || null);
    // Respuesta vieja: hubo otra consulta o una edición manual mientras viajaba.
    if (seq !== kmReqSeq.current) return;
    if (!res) {
      // Par (o vía) sin historial: no dejar colgados los km de la ruta anterior.
      if (authoritative || !kmDirty.current) {
        setKmConCarga("0");
        setKmVacios("0");
        setKmHistHint(
          `Sin historial de ${oo} → ${dd}${via ? ` por ${VIA_LABEL[via]}` : ""}: cargá los km a mano esta vez.`,
        );
        kmDirty.current = false;
      }
      return;
    }
    // Un viaje es UN tramo: la distancia va entera al campo que le corresponde
    // según si va cargado o vacío. Mandarla siempre a "km con carga" le movía
    // los km a los tramos vacíos y los hacía desaparecer de la hoja de ruta.
    ponerKm(res.distancia, esVacio);
    kmDirty.current = false;
    setKmHistHint(
      `Km recalculados del historial (${oo} → ${dd}${via ? ` por ${VIA_LABEL[via]}` : ""}). Editá si esta vez fue distinto.`,
    );
  };

  // Marcar/desmarcar "vacío" mueve la distancia de columna (es la misma: el tramo
  // mide lo que mide) y, si pasa a vacío, no puede quedar facturando.
  const handleEsVacio = (v: boolean) => {
    setEsVacio(v);
    const distancia = (Number(kmConCarga) || 0) + (Number(kmVacios) || 0);
    if (distancia > 0) ponerKm(distancia, v);
    if (v) {
      // Un vacío no lleva carga ni plata: el sistema no lo factura igual, y
      // dejarlo con monto era guardar plata que después no contaba en ningún total.
      setTonelaje("0");
      setMontoFlete("0");
      setTarifaId("");
      montoDirty.current = true;
      setImporteHint(null);
    }
  };

  // Cambiar la vía redefine la distancia: recalcula los km del historial de ESA vía.
  const handleRutaVia = (v: "" | "ruta_5" | "ruta_22") => {
    setRutaVia(v);
    if (origenNombre.trim() && destinoNombre.trim()) {
      applyKmHistorico(origenNombre, destinoNombre, true, v);
    }
  };

  // Km editados a mano: no los pisa el autocompletado al tipear ni una respuesta
  // del historial que siga en vuelo.
  const setKmManual = (which: "con" | "vac", v: string) => {
    kmDirty.current = true;
    kmReqSeq.current++;
    setKmHistHint(null);
    if (which === "con") setKmConCarga(v);
    else setKmVacios(v);
  };

  // Fallback para cuando el lugar se escribe a mano (sin elegir del desplegable).
  // Debounce para no pegarle al server en cada tecla; el caso "elegí del
  // desplegable" lo maneja onSelect, al instante.
  useEffect(() => {
    if (loadingData || !formOptions) return;
    if (kmDirty.current) return;
    let cancelado = false;
    const t = setTimeout(() => {
      if (cancelado) return;
      applyKmHistorico(origenNombre, destinoNombre, false);
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rutaVia dispara su propio recálculo autoritativo en handleRutaVia
  }, [origenNombre, destinoNombre, loadingData, formOptions]);

  const isFacturado = viaje.facturado;

  const isOtros =
    tipoCargaId === "otros" ||
    formOptions?.tipos_carga.find((t) => t.id === tipoCargaId)?.label.toLowerCase() === "otros";

  // Camión "habitual" del chofer seleccionado. Sirve para avisar si el
  // viaje quedó cargado con una unidad distinta a la asignada (los choferes
  // rotan: enfermos, roturas, etc.).
  const camionHabitualId =
    formOptions?.choferes.find((c) => c.id === choferId)?.camionId ?? null;
  const usandoCamionHabitual = !!camionHabitualId && camionId === camionHabitualId;
  const cambioDeCamion =
    !!choferId && !!camionId && !!camionHabitualId && !usandoCamionHabitual;

  // Al elegir un circuito: autocompletar origen, destino y km (quedan editables).
  const handleCircuitoChange = (circuitoId: string) => {
    routeTouched.current = true;
    setRutaId(circuitoId);
    const c = formOptions?.circuitos.find((x) => x.id === circuitoId);
    if (c) {
      setOrigenNombre(c.origen === "—" ? "" : c.origen);
      setDestinoNombre(c.destino === "—" ? "" : c.destino);
      // Un viaje es un tramo (cargado o vacío), nunca ambos: la distancia del
      // circuito va a la columna que corresponda según el modo del viaje.
      ponerKm(c.km_con_carga || c.km_vacios, esVacio);
      // Los km vienen del circuito elegido: que no los pise el historial.
      kmDirty.current = true;
      kmReqSeq.current++;
      setKmHistHint(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const result = await updateViajeAction(viaje.id, {
      fecha_viaje: fechaViaje,
      cliente_id: clienteId,
      chofer_id: choferId,
      camion_id: camionId,
      tipo_carga_id: tipoCargaId,
      ruta_id: rutaId || null,
      descripcion_otros: descripcionOtros.trim() || null,
      origen_nombre: origenNombre.trim() || null,
      destino_nombre: destinoNombre.trim() || null,
      km_con_carga: Number(kmConCarga) || 0,
      km_vacios: Number(kmVacios) || 0,
      ruta_via: rutaVia || null,
      tonelaje_real: Number(tonelaje) || 0,
      monto_flete: Number(montoFlete) || 0,
      tarifa_id: tarifaId || null,
      nro_viaje_ypf: nroViajeYpf.trim() || null,
      material: material.trim() || null,
      es_vacio: esVacio,
    });

    setSubmitting(false);

    if (!result?.ok) {
      if (result?.fieldErrors) setFieldErrors(result.fieldErrors);
      setError(result?.error ?? "Error al guardar los cambios.");
      return;
    }

    const clienteLabel = formOptions?.clientes.find((c) => c.id === clienteId)?.label;
    const choferLabel = formOptions?.choferes.find((c) => c.id === choferId)?.label;
    const camionLabel = formOptions?.camiones.find((c) => c.id === camionId)?.label;
    // El estado de facturado lo decide la MISMA regla del servidor: si no se
    // manda en el patch, la fila queda mostrando el importe nuevo al lado de un
    // "SIN REMITO" viejo hasta que alguien recargue.
    const facturado = viajeEstaFacturado(Number(montoFlete) || 0, esVacio);

    onSuccess({
      fecha_viaje: fechaViaje,
      cliente: clienteLabel ?? viaje.cliente,
      chofer: choferLabel ?? viaje.chofer,
      camion: camionLabel ?? viaje.camion,
      origen: origenNombre.trim() || null,
      destino: destinoNombre.trim() || null,
      km_con_carga: Number(kmConCarga) || 0,
      km_vacios: Number(kmVacios) || 0,
      km_totales: (Number(kmConCarga) || 0) + (Number(kmVacios) || 0),
      toneladas: Number(tonelaje) || 0,
      monto_flete: Number(montoFlete) || null,
      nro_viaje_ypf: nroViajeYpf.trim() || null,
      material: material.trim() || null,
      es_vacio: esVacio,
      facturado,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[calc(100dvh-2rem)] sm:max-h-[95vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-slate-100 text-slate-600 shrink-0">
              <Pencil size={20} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[#0F172A] text-base sm:text-lg font-bold">
                Editar viaje {viaje.codigo}
              </DialogTitle>
              <DialogDescription className="text-[#64748B] text-xs font-medium mt-0.5">
                {viaje.cliente}
                {viaje.origen && viaje.destino ? ` · ${viaje.origen} → ${viaje.destino}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500 text-sm">
            <Loader2 size={18} className="animate-spin" />
            Cargando datos del viaje...
          </div>
        ) : loadError ? (
          <div className="px-4 sm:px-6 py-10 text-center text-red-600 text-sm font-medium">{loadError}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            {/* Alerta viaje facturado */}
            {isFacturado && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    Viaje facturado — ya impactó en la caja
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Si cambiás el monto de flete, el movimiento en caja <strong>no se actualiza automáticamente</strong>. Ajustalo manualmente desde la sección Caja.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <InlineFeedback
                variant="error"
                message={error}
                onDismiss={() => setError(null)}
                autoHideMs={0}
              />
            )}

            {/* Fecha */}
            <CField
              label="Fecha del viaje *"
              icon={Calendar}
              error={fieldErrors.fecha_viaje}
            >
              <input
                type="date"
                value={fechaViaje}
                onChange={(e) => setFechaViaje(e.target.value)}
                required
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
              />
            </CField>

            {/* Cliente */}
            <CField label="Cliente *" icon={User} error={fieldErrors.cliente_id}>
              <Combobox
                value={clienteId}
                onValueChange={(v) => {
                  routeTouched.current = true;
                  setClienteId(v);
                }}
                options={formOptions?.clientes ?? []}
                placeholder="Seleccioná un cliente..."
                searchPlaceholder="Buscar cliente..."
                required
                triggerClassName={FIELD_COMBO_TRIGGER}
              />
            </CField>

            {/* Chofer y Camión */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CField label="Chofer *" icon={LifeBuoy} error={fieldErrors.chofer_id}>
                <Combobox
                  value={choferId}
                  onValueChange={(nid) => {
                    setChoferId(nid);
                    // Auto-completar camión asignado si el camión no fue tocado manualmente
                    const chofer = formOptions?.choferes.find((c) => c.id === nid);
                    if (chofer?.camionId) setCamionId(chofer.camionId);
                  }}
                  options={formOptions?.choferes ?? []}
                  placeholder="Seleccioná..."
                  searchPlaceholder="Buscar chofer..."
                  required
                  triggerClassName={FIELD_COMBO_TRIGGER}
                />
              </CField>

              <div>
                <CField label="Camión *" icon={Truck} error={fieldErrors.camion_id}>
                  <Combobox
                    value={camionId}
                    onValueChange={setCamionId}
                    options={formOptions?.camiones ?? []}
                    placeholder="Seleccioná..."
                    searchPlaceholder="Buscar patente..."
                    required
                    triggerClassName={FIELD_COMBO_TRIGGER}
                  />
                </CField>
                {usandoCamionHabitual && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Es el camión habitual de este chofer.
                  </p>
                )}
                {cambioDeCamion && (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium">
                    Aviso: distinto al camión habitual de este chofer.
                  </p>
                )}
              </div>
            </div>

            {/* Tipo de carga */}
            <CField label="Tipo de carga *" icon={Package} error={fieldErrors.tipo_carga_id}>
              <Combobox
                value={tipoCargaId}
                onValueChange={setTipoCargaId}
                options={formOptions?.tipos_carga ?? []}
                placeholder="Seleccioná..."
                required
                triggerClassName={FIELD_COMBO_TRIGGER}
              />
            </CField>

            {isOtros && (
              <CField label="Descripción de la carga *" icon={FileText}>
                <input
                  type="text"
                  value={descripcionOtros}
                  onChange={(e) => setDescripcionOtros(e.target.value)}
                  placeholder="Especificá el tipo de carga..."
                  required
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
            )}

            {/* Circuito predefinido (opcional): autocompleta origen, destino y km */}
            {(formOptions?.circuitos.length ?? 0) > 0 && (
              <CField label="Circuito (opcional)" icon={Route}>
                <Combobox
                  value={rutaId}
                  onValueChange={handleCircuitoChange}
                  options={(formOptions?.circuitos ?? []).map((c) => ({
                    id: c.id,
                    label: c.label,
                  }))}
                  placeholder="Elegí un circuito para autocompletar…"
                  searchPlaceholder="Buscar circuito..."
                  clearable
                  triggerClassName={FIELD_COMBO_TRIGGER}
                />
              </CField>
            )}

            {/* Origen y Destino — desplegable propio con texto libre (reemplaza
                al <datalist> nativo, feo en macOS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PlaceCombobox
                label="Origen"
                name="origen_nombre"
                icon={MapPin}
                placeholder="Escribí o elegí un lugar..."
                options={formOptions?.puntos_ruta ?? []}
                value={origenNombre}
                onValueChange={(v) => {
                  routeTouched.current = true;
                  setOrigenNombre(v);
                }}
                onSelect={(o) => applyKmHistorico(o, destinoNombre, true)}
                error={fieldErrors.origen_nombre}
              />
              <PlaceCombobox
                label="Destino"
                name="destino_nombre"
                icon={Flag}
                placeholder="Escribí o elegí un lugar..."
                options={formOptions?.puntos_ruta ?? []}
                value={destinoNombre}
                onValueChange={(v) => {
                  routeTouched.current = true;
                  setDestinoNombre(v);
                }}
                onSelect={(d) => applyKmHistorico(origenNombre, d, true)}
                error={fieldErrors.destino_nombre}
              />
            </div>

            {/* ¿Fue cargado o volvió vacío? Define en qué columna van los km y
                si el viaje factura. Sin esto, un viaje anotado mal como vacío no
                se podía corregir desde ninguna pantalla. */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                <Package size={12} /> ¿Llevaba carga?
              </label>
              <CargaSegmented value={esVacio} onChange={handleEsVacio} />
            </div>

            {/* KM y Tonelaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <CField label="Km con carga" icon={Navigation} error={fieldErrors.km_con_carga}>
                <input
                  type="number"
                  value={kmConCarga}
                  onChange={(e) => setKmManual("con", e.target.value)}
                  min="0"
                  disabled={esVacio}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A] disabled:text-muted-foreground/50"
                />
              </CField>
              <CField label="Km vacíos" icon={Navigation} error={fieldErrors.km_vacios}>
                <input
                  type="number"
                  value={kmVacios}
                  onChange={(e) => setKmManual("vac", e.target.value)}
                  min="0"
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
                />
              </CField>
              <CField label="Tonelaje (tn)" icon={Scale} error={fieldErrors.tonelaje_real}>
                <input
                  type="number"
                  value={tonelaje}
                  onChange={(e) => {
                    routeTouched.current = true;
                    setTonelaje(e.target.value);
                  }}
                  min="0"
                  step="0.01"
                  disabled={esVacio}
                  className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A] disabled:text-muted-foreground/50"
                />
              </CField>
            </div>

            {kmHistHint && (
              <p className="flex items-center gap-1.5 text-[11px] text-[#0277BD] font-medium animate-in fade-in duration-200">
                <Navigation size={12} className="shrink-0" />
                {kmHistHint}
              </p>
            )}

            {/* Vía del viaje: Ruta 5 (directa) vs Ruta 22 (por la base) — define los
                km propios del par. La marca la trae el Excel; acá se puede corregir. */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                <Route size={12} /> ¿Por qué ruta fue?
              </label>
              <ViaSegmented value={rutaVia} onChange={handleRutaVia} />
            </div>

            {/* Monto de flete — se recalcula por tarifa si cambiás destino/tonelaje (editable) */}
            {esVacio && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AlertTriangle size={12} className="shrink-0" />
                Los viajes vacíos no se facturan: el importe queda en cero.
              </p>
            )}
            <CField label="Monto de flete (ARS)" icon={DollarSign} error={fieldErrors.monto_flete}>
              <input
                type="number"
                value={montoFlete}
                onChange={(e) => handleMontoManual(e.target.value)}
                min="0"
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
              />
            </CField>
            {importeHint && (
              <p className="flex items-center gap-1.5 text-[11px] text-[#0277BD] font-medium animate-in fade-in duration-200">
                <DollarSign size={12} className="shrink-0" />
                {importeHint}
              </p>
            )}

            {/* Material (opcional) */}
            <CField label="Material" icon={Package} error={fieldErrors.material}>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Ej: Cemento, Clinker, Arena (opcional)"
                maxLength={120}
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
              />
            </CField>

            {/* Nº de viaje (opcional) */}
            <CField label="Nº de viaje" icon={Hash} error={fieldErrors.nro_viaje_ypf}>
              <input
                type="text"
                value={nroViajeYpf}
                onChange={(e) => setNroViajeYpf(e.target.value)}
                placeholder="Ej: 123456 (opcional)"
                maxLength={60}
                className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none text-[#0F172A]"
              />
            </CField>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border -mx-4 px-4 sm:-mx-6 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || loadingData}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center justify-center gap-1.5 h-10 w-full sm:w-auto px-6 rounded-lg font-bold shadow-sm"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                ) : (
                  <><Check size={15} /> Guardar cambios</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Cargado vs vacío. La distancia del tramo es la misma; lo que cambia es en qué
 *  columna se cuenta y si el viaje factura. */
function CargaSegmented({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const opts: { v: boolean; label: string; title: string }[] = [
    { v: false, label: "Con carga", title: "Viaje cargado: los km van a KM REC y se factura" },
    { v: true, label: "Vacío", title: "Vuelta sin carga: los km van a km vacíos y no factura" },
  ];
  return (
    <div className="flex w-full sm:inline-flex sm:w-auto rounded-lg border border-border overflow-hidden">
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={o.label}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className={`flex-1 sm:flex-none px-2 sm:px-3 h-9 text-xs font-semibold transition-colors ${i > 0 ? "border-l border-border" : ""} ${
              active ? "bg-[#0088D1]/10 text-[#0277BD]" : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selector segmentado de vía: Sin marcar · Ruta 5 · Ruta 22 (mismo control que
 *  en Nuevo viaje). La vía define los km propios del par origen→destino. */
function ViaSegmented({
  value,
  onChange,
}: {
  value: "" | "ruta_5" | "ruta_22";
  onChange: (v: "" | "ruta_5" | "ruta_22") => void;
}) {
  const opts: { v: "" | "ruta_5" | "ruta_22"; label: string; title: string }[] = [
    { v: "", label: "Sin marcar", title: "No aplica o no se sabe por dónde fue" },
    { v: "ruta_5", label: "Ruta 5", title: "Directa (más corta): van derecho, no pasan por la base" },
    { v: "ruta_22", label: "Ruta 22", title: "Por la base/zona: cargar combustible, arreglar roturas" },
  ];
  return (
    <div className="flex w-full sm:inline-flex sm:w-auto rounded-lg border border-border overflow-hidden">
      {opts.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={o.label}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.v)}
            className={`flex-1 sm:flex-none px-2 sm:px-3 h-9 text-xs font-semibold transition-colors ${i > 0 ? "border-l border-border" : ""} ${
              active ? "bg-[#0088D1]/10 text-[#0277BD]" : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CField({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-[#475569]">{label}</label>
      <div
        className={`relative flex items-center h-10 w-full rounded-lg border bg-white overflow-hidden focus-within:ring-2 transition-all ${
          error
            ? "border-red-300 focus-within:ring-red-100 focus-within:border-red-500"
            : "border-[#E2E8F0] focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
        }`}
      >
        <div className="flex items-center justify-center w-10 h-full border-r border-[#E2E8F0] bg-slate-50/50 text-[#0088D1] shrink-0">
          <Icon size={15} />
        </div>
        {children}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
