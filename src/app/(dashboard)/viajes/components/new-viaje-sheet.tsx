"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/combobox";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import {
  Plus,
  X,
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
  FileText,
  Hash,
  Route,
  CalendarOff,
  RotateCcw,
  PackageX,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

/** Formatea "YYYY-MM-DD" como "DD/MM". */
function fmtDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Vías con distancia propia (reunión Nico 02/07): la Ruta 5 va derecho (más
// corta) y la Ruta 22 pasa por la base/zona (combustible, roturas).
const VIA_LABEL: Record<"ruta_5" | "ruta_22", string> = {
  ruta_5: "Ruta 5",
  ruta_22: "Ruta 22",
};

type ViaValue = "" | "ruta_5" | "ruta_22";

/**
 * Un tramo de la salida después del viaje principal. La vuelta clásica es el
 * tramo 2, pero pueden seguir: Cerrito→Ramallo vacío y Ramallo→Lomaser cargado
 * son dos tramos más que antes quedaban sin registrar.
 */
type Tramo = {
  /** Identidad estable para la lista y para el estado de km por tramo. */
  id: number;
  modo: "vacio" | "cargado";
  origen: string;
  destino: string;
  kmConCarga: string;
  kmVacios: string;
  via: ViaValue;
  tonelaje: string;
  monto: string;
  material: string;
  nroYpf: string;
};

/** Mismo tope que valida el servidor (`MAX_TRAMOS` en viajes/actions.ts). */
const MAX_TRAMOS_UI = 12;

/** Selector segmentado de vía: Sin marcar · Ruta 5 · Ruta 22. */
function ViaSegmented({ value, onChange }: { value: ViaValue; onChange: (v: ViaValue) => void }) {
  const opts: { v: ViaValue; label: string; title: string }[] = [
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
              active
                ? "bg-[#0088D1]/10 text-[#0277BD]"
                : "bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
import {
  createViajeAction,
  getKmHistoricoAction,
  getImporteSugeridoAction,
  type CreateViajeState,
  type ViajeFormData,
} from "../actions";
import { proponerTramo } from "@/domain/viajes/tramos";

export default function NewViajeSheet({ data }: { data: ViajeFormData }) {
  const [open, setOpen] = useState(false);
  const [tipoCarga, setTipoCarga] = useState("");
  // Cliente: necesario para buscar la tarifa que precarga el monto del flete.
  const [selectedClienteId, setSelectedClienteId] = useState("");
  // Auto-camión: al elegir chofer, se pre-selecciona su camión asignado
  // (pero el usuario puede cambiarlo: los choferes rotan unidades).
  const [selectedChoferId, setSelectedChoferId] = useState("");
  const [selectedCamionId, setSelectedCamionId] = useState("");
  // Circuito: al elegirlo se autocompletan origen/destino y km (editables).
  const [selectedCircuitoId, setSelectedCircuitoId] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [kmConCarga, setKmConCarga] = useState("0");
  const [kmVacios, setKmVacios] = useState("0");
  // Vía del viaje (reunión Nico 02/07): Ruta 5 = directa · Ruta 22 = por la
  // base. De la vía dependen los km, así que el historial se consulta por vía.
  const [rutaVia, setRutaVia] = useState<"" | "ruta_5" | "ruta_22">("");
  const [tonelaje, setTonelaje] = useState("0");
  // Monto de flete (controlado): lo precarga la tarifa del destino y queda editable.
  const [montoFlete, setMontoFlete] = useState("0");
  // Tarifa que precargó el monto (snapshot). Se limpia si el operador edita el
  // monto a mano (entonces el monto ya no proviene de esa tarifa).
  const [tarifaId, setTarifaId] = useState("");
  // `true` cuando los km se cargaron a mano o por circuito: el autocompletado
  // por historial no debe pisarlos al tipear. Al elegir un destino del
  // desplegable sí se vuelven a calcular (eso es autoritativo).
  const kmDirty = useRef(false);
  // Mismo flag para el monto: si se editó a mano, la tarifa no lo pisa.
  const montoDirty = useRef(false);
  // Secuencia de consultas de km al historial: una edición manual o una consulta
  // más nueva invalidan las respuestas en vuelo. Sin esto, una respuesta lenta
  // del server pisaba lo que el operador ya había corregido a mano (reunión
  // Nico 02/07: "tardaba en cargar y el km de la vuelta salía raro").
  const kmReqSeq = useRef(0);
  // Aviso cuando los km se precargan desde el historial del par origen→destino.
  const [kmHistHint, setKmHistHint] = useState<string | null>(null);
  // Aviso cuando el monto se precarga desde la tarifa vigente del destino.
  const [importeHint, setImporteHint] = useState<string | null>(null);
  // Tramos siguientes de la salida, en orden. Una vuelta rara vez es "ida y
  // vuelta y listo": Nico (27/07) carga Olavarría→Cerrito, después Cerrito→
  // Ramallo vacío y Ramallo→Lomaser cargado. Antes solo entraba UN tramo de
  // vuelta y el resto quedaba sin registrar.
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const tramoIdSeq = useRef(0);
  // Por tramo: si le tocaron los km a mano y la secuencia de consultas en vuelo.
  const tramoKm = useRef(new Map<number, { dirty: boolean; seq: number }>());
  const router = useRouter();

  // Camión "habitual" del chofer seleccionado (puede no haber).
  const camionHabitualId =
    data.choferes.find((c) => c.id === selectedChoferId)?.camionId ?? null;
  const usandoCamionHabitual =
    !!camionHabitualId && selectedCamionId === camionHabitualId;
  const cambioDeCamion =
    !!selectedChoferId && !!selectedCamionId && !!camionHabitualId && !usandoCamionHabitual;

  // Aviso si el chofer elegido está (o estará pronto) de vacaciones/ausente.
  const choferAusencia =
    data.choferes.find((c) => c.id === selectedChoferId)?.ausencia ?? null;

  const [state, formAction] = useActionState<CreateViajeState, FormData>(
    createViajeAction,
    null,
  );

  const resetCampos = () => {
    setTipoCarga("");
    setSelectedClienteId("");
    setSelectedChoferId("");
    setSelectedCamionId("");
    setSelectedCircuitoId("");
    setOrigen("");
    setDestino("");
    setKmConCarga("0");
    setKmVacios("0");
    setRutaVia("");
    setTonelaje("0");
    setMontoFlete("0");
    setTarifaId("");
    montoDirty.current = false;
    setImporteHint(null);
    kmDirty.current = false;
    setKmHistHint(null);
    setTramos([]);
    tramoKm.current.clear();
  };

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setOpen(false);
      resetCampos();
      window.dispatchEvent(new Event("viaje-created"));
      router.refresh();
    }
  }, [state, router]);

  // Trae los km del último viaje con ese par origen→destino (y esa vía, si está
  // marcada: Ruta 5 y Ruta 22 tienen distancias distintas).
  //  - authoritative=true  (al elegir del desplegable): recalcula al instante y
  //    pisa lo que haya (cambiar de destino o de vía redefine la ruta).
  //  - authoritative=false (al tipear): solo completa si nadie tocó los km.
  const applyKmHistorico = async (
    o: string,
    d: string,
    authoritative: boolean,
    via: "" | "ruta_5" | "ruta_22" = rutaVia,
  ) => {
    const oo = o.trim();
    const dd = d.trim();
    if (!oo || !dd || oo === "—" || dd === "—") {
      setKmHistHint(null);
      return;
    }
    if (!authoritative && kmDirty.current) return;
    const seq = ++kmReqSeq.current;
    const res = await getKmHistoricoAction(oo, dd, via || null);
    // Respuesta vieja: hubo otra consulta o una edición manual mientras viajaba.
    if (seq !== kmReqSeq.current) return;
    if (!res) {
      // Par (o vía) sin historial: al elegirlo a propósito, no dejes los km de
      // otra ruta colgados. La primera vez se tipean a mano y quedan aprendidos.
      if (authoritative) {
        setKmConCarga("0");
        setKmVacios("0");
        setKmHistHint(
          via ? `Sin historial de ${VIA_LABEL[via]} para ${oo} → ${dd}: cargá los km a mano esta vez.` : null,
        );
        kmDirty.current = false;
      }
      return;
    }
    setKmConCarga(String(res.distancia));
    setKmVacios("0"); // el viaje principal es cargado; la vuelta vacía va aparte
    kmDirty.current = false;
    setKmHistHint(
      `Km precargados del historial (${oo} → ${dd}${via ? ` por ${VIA_LABEL[via]}` : ""}). Editá si esta vez fue distinto.`,
    );
  };

  // Cambiar la vía redefine la distancia: recalcula los km del historial de ESA vía.
  const handleRutaVia = (v: "" | "ruta_5" | "ruta_22") => {
    setRutaVia(v);
    if (origen && destino) applyKmHistorico(origen, destino, true, v);
  };

  // Marca los km como editados a mano (no los pisa el autocompletado al tipear
  // ni una respuesta del historial que siga en vuelo).
  const setKmManual = (which: "con" | "vac", v: string) => {
    kmDirty.current = true;
    kmReqSeq.current++;
    setKmHistHint(null);
    // Un viaje es un tramo: cargado O vacío. Al poner un valor en uno, el otro
    // vuelve a 0 y queda deshabilitado — nunca conviven km con carga y vacíos.
    if (which === "con") {
      setKmConCarga(v);
      if ((Number(v) || 0) > 0) setKmVacios("0");
    } else {
      setKmVacios(v);
      if ((Number(v) || 0) > 0) setKmConCarga("0");
    }
  };

  // ── Tramos ────────────────────────────────────────────────────────────────
  const estadoKm = (id: number) => {
    let e = tramoKm.current.get(id);
    if (!e) {
      e = { dirty: false, seq: 0 };
      tramoKm.current.set(id, e);
    }
    return e;
  };

  const setTramo = (id: number, patch: Partial<Tramo>) =>
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Autocompletar los km de un tramo desde el historial del par (al elegir
  // origen/destino del desplegable). Según el modo, completa el campo que
  // corresponde.
  const applyTramoKm = async (
    id: number,
    o: string,
    d: string,
    modo: "vacio" | "cargado",
    via: "" | "ruta_5" | "ruta_22",
  ) => {
    const oo = o.trim();
    const dd = d.trim();
    if (!oo || !dd || oo === "—" || dd === "—") return;
    const est = estadoKm(id);
    if (est.dirty) return;
    const seq = ++est.seq;
    const res = await getKmHistoricoAction(oo, dd, via || null);
    // Respuesta vieja: se editó, cambió el modo o salió otra consulta.
    if (seq !== est.seq || est.dirty) return;
    if (!res) return;
    setTramo(
      id,
      modo === "cargado"
        ? { kmConCarga: String(res.distancia) }
        : { kmVacios: String(res.distancia) },
    );
  };

  // Marca los km de un tramo como editados a mano.
  const setTramoKmManual = (t: Tramo, which: "con" | "vac", v: string) => {
    const est = estadoKm(t.id);
    est.dirty = true;
    est.seq++;
    setTramo(t.id, which === "con" ? { kmConCarga: v } : { kmVacios: v });
  };

  // Cambiar la vía recalcula los km desde el historial de esa vía.
  const setTramoVia = (t: Tramo, via: "" | "ruta_5" | "ruta_22") => {
    const est = estadoKm(t.id);
    est.dirty = false;
    est.seq++; // invalida consultas en vuelo de la vía anterior
    setTramo(t.id, { via });
    if (t.origen && t.destino) applyTramoKm(t.id, t.origen, t.destino, t.modo, via);
  };

  // Al cambiar de modo se mueve la distancia entre "con carga" y "vacíos" para
  // no tener que recargarla a mano.
  const setTramoModo = (t: Tramo, modo: "vacio" | "cargado") => {
    const est = estadoKm(t.id);
    est.dirty = false;
    est.seq++; // una consulta en vuelo del modo anterior ya no aplica
    if (modo === "cargado") {
      const dist = t.kmVacios !== "0" ? t.kmVacios : t.kmConCarga;
      setTramo(t.id, { modo, kmConCarga: dist, kmVacios: "0" });
    } else {
      const dist = t.kmConCarga !== "0" ? t.kmConCarga : t.kmVacios;
      setTramo(t.id, {
        modo,
        kmVacios: dist,
        kmConCarga: "0",
        tonelaje: "0",
        monto: "0",
        material: "",
      });
    }
  };

  // Agrega un tramo encadenado: arranca donde terminó el anterior. El primero
  // además propone la vuelta (invierte la ida) con su distancia, que es el caso
  // más común; los siguientes solo heredan el origen porque a dónde va después
  // no hay forma de adivinarlo.
  const agregarTramo = () => {
    const ultimo = tramos[tramos.length - 1] ?? null;
    const prop = proponerTramo(
      { origen, destino, kmConCarga, kmVacios },
      ultimo ? ultimo.destino : null,
    );
    const id = ++tramoIdSeq.current;
    tramoKm.current.set(id, { dirty: false, seq: 0 });
    setTramos((prev) => [
      ...prev,
      {
        id,
        modo: "vacio",
        origen: prop.origen,
        destino: prop.destino,
        kmConCarga: "0",
        kmVacios: prop.kmVacios,
        via: "",
        tonelaje: "0",
        monto: "0",
        material: "",
        nroYpf: "",
      },
    ]);
    // Al historial solo se le pregunta si no quedó una distancia mejor a mano:
    // pisar la copia de la ida con una respuesta lenta hacía que el valor
    // "cambiara solo" a algo viejo (reunión Nico 02/07).
    if (prop.kmVacios === "0" && prop.origen && prop.destino) {
      applyTramoKm(id, prop.origen, prop.destino, "vacio", "");
    }
  };

  const quitarTramo = (id: number) => {
    tramoKm.current.delete(id);
    setTramos((prev) => prev.filter((t) => t.id !== id));
  };

  // Fallback para cuando se escribe el lugar a mano (sin elegir del desplegable):
  // completa los km si todavía nadie los tocó. Debounce para no pegarle al server
  // en cada tecla. El caso "elegí del desplegable" lo maneja onSelect, al instante.
  useEffect(() => {
    const o = origen.trim();
    const d = destino.trim();
    if (!o || !d || o === "—" || d === "—") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar el aviso cuando el par queda incompleto
      setKmHistHint(null);
      return;
    }
    if (kmDirty.current) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      // Solo lectura de la secuencia: si al volver cambió (edición manual o
      // consulta autoritativa posterior), esta respuesta ya no aplica.
      const seq = kmReqSeq.current;
      const res = await getKmHistoricoAction(o, d, rutaVia || null);
      if (cancelado || !res || kmDirty.current || seq !== kmReqSeq.current) return;
      setKmConCarga(String(res.distancia));
      setKmVacios("0"); // viaje principal = cargado; la vuelta vacía va aparte
      setKmHistHint(
        `Km precargados del historial (${o} → ${d}${rutaVia ? ` por ${VIA_LABEL[rutaVia]}` : ""}). Editá si esta vez fue distinto.`,
      );
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rutaVia dispara su propio recálculo autoritativo en handleRutaVia
  }, [origen, destino]);

  // Marca el monto como editado a mano: la tarifa no lo pisa y dejamos de
  // atribuirlo a una tarifa (se limpia el snapshot tarifa_id).
  const setMontoManual = (v: string) => {
    montoDirty.current = true;
    setImporteHint(null);
    setTarifaId("");
    setMontoFlete(v);
  };

  // Autocompletar el MONTO DE FLETE desde la tarifa vigente del destino, igual
  // que lo calcula el DM (toneladas × precio del destino). Solo precarga si el
  // operador no tocó el monto a mano. Se recalcula al cambiar cliente, destino o
  // tonelaje (la tarifa por tonelada depende del tonelaje). Debounce para no
  // pegarle al server en cada tecla.
  useEffect(() => {
    if (montoDirty.current) return;
    const o = origen.trim();
    const d = destino.trim();
    const tn = Number(tonelaje) || 0;
    if (!selectedClienteId || !d || d === "—") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar el aviso cuando faltan datos para calcular
      setImporteHint(null);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      const res = await getImporteSugeridoAction(selectedClienteId, o, d, tn, Number(kmConCarga) || 0);
      if (cancelado || montoDirty.current) return;
      if (!res) {
        setImporteHint(null);
        setTarifaId("");
        return;
      }
      setMontoFlete(String(res.importe));
      setTarifaId(res.tarifaId);
      setImporteHint(`Importe calculado por tarifa (${res.detalle}). Editá si esta vez fue distinto.`);
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [selectedClienteId, origen, destino, tonelaje, kmConCarga]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetCampos();
  };

  // Al elegir un circuito: autocompletar origen, destino y km (quedan editables).
  const handleCircuitoChange = (circuitoId: string) => {
    setSelectedCircuitoId(circuitoId);
    const c = data.circuitos.find((x) => x.id === circuitoId);
    if (c) {
      setOrigen(c.origen === "—" ? "" : c.origen);
      setDestino(c.destino === "—" ? "" : c.destino);
      // El viaje principal es cargado: la distancia del circuito va a km con
      // carga y los vacíos quedan en 0 (la vuelta vacía es un viaje aparte).
      setKmConCarga(String(c.km_con_carga || c.km_vacios));
      setKmVacios("0");
      // Km del circuito = valores explícitos: que el autocompletado no los pise.
      kmDirty.current = true;
      setKmHistHint(null);
    }
  };

  const handleChoferChange = (choferId: string) => {
    setSelectedChoferId(choferId);
    // Pre-llenar con el camión habitual del chofer (es solo un default —
    // los choferes rotan unidades cuando hay enfermos o roturas).
    const chofer = data.choferes.find((c) => c.id === choferId);
    if (chofer?.camionId) {
      setSelectedCamionId(chofer.camionId);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Button variant="brand" size="sm" onClick={() => setOpen(true)} className="bg-[#0088D1] hover:bg-[#0277BD] text-white">
        <Plus size={14} />
        Nuevo viaje
      </Button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(900px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] sm:max-h-[95vh] flex flex-col bg-card rounded-[16px] shadow-2xl border border-border transition duration-150 ease-out data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="flex items-center justify-center size-10 sm:size-12 rounded-full bg-[#E1F5FE] text-primary shrink-0">
                <Truck size={22} />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="text-foreground text-base sm:text-lg font-bold">
                  Nuevo viaje
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground text-xs font-medium mt-0.5">
                  Asociá chofer, camión, cliente y ruta. El código se genera automáticamente.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted inline-flex items-center justify-center transition-colors"
                  aria-label="Cerrar"
                />
              }
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Form */}
          <form
            action={formAction}
            key={open ? "open" : "closed"}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4"
          >
            <input type="hidden" name="estado" value="pendiente" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputFieldWithIcon
                label="Fecha del viaje *"
                name="fecha_viaje"
                type="date"
                defaultValue={today}
                required
                icon={Calendar}
                error={state?.fieldErrors?.fecha_viaje}
              />

              {/* Cliente — al elegirlo se puede precargar el monto desde su tarifa */}
              <SelectField
                label="Cliente *"
                name="cliente_id"
                options={data.clientes}
                required
                icon={User}
                error={state?.fieldErrors?.cliente_id}
                onValueChange={setSelectedClienteId}
                searchPlaceholder="Buscar cliente..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Chofer */}
              <SelectField
                label="Chofer *"
                name="chofer_id"
                options={data.choferes}
                required
                icon={LifeBuoy}
                error={state?.fieldErrors?.chofer_id}
                onValueChange={handleChoferChange}
                searchPlaceholder="Buscar chofer..."
              />
              {/* Camion — controlado para recibir auto-completado.
                  El chofer-camión es flexible: rotan unidades. */}
              <div>
                <SelectField
                  label="Camión *"
                  name="camion_id"
                  options={data.camiones}
                  required
                  icon={Truck}
                  error={state?.fieldErrors?.camion_id}
                  value={selectedCamionId}
                  onValueChange={setSelectedCamionId}
                  searchPlaceholder="Buscar patente..."
                />
                {usandoCamionHabitual && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Es el camión habitual de este chofer. Cambialo si esta vez manejó otro.
                  </p>
                )}
                {cambioDeCamion && (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium">
                    Aviso: distinto al camión habitual de este chofer.
                  </p>
                )}
              </div>
            </div>

            {/* Aviso de vacaciones / ausencia del chofer elegido */}
            {choferAusencia && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 animate-in fade-in slide-in-from-top-1 duration-200">
                <CalendarOff size={15} className="mt-0.5 shrink-0" />
                <span>
                  {choferAusencia.enCurso ? (
                    <>
                      Este chofer está de <strong>{choferAusencia.tipo}</strong> (hasta el{" "}
                      <strong>{fmtDia(choferAusencia.hasta)}</strong>). Revisá antes de asignarle el viaje.
                    </>
                  ) : (
                    <>
                      Ojo: este chofer tiene <strong>{choferAusencia.tipo}</strong> del{" "}
                      <strong>{fmtDia(choferAusencia.desde)}</strong> al{" "}
                      <strong>{fmtDia(choferAusencia.hasta)}</strong>.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Tipo de Carga */}
            <SelectField
              label="Tipo de carga *"
              name="tipo_carga_id"
              options={data.tipos_carga}
              required
              icon={Package}
              error={state?.fieldErrors?.tipo_carga_id}
              onValueChange={setTipoCarga}
            />

            {/* Descripcion si es otros */}
            {tipoCarga === "otros" && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <InputFieldWithIcon
                  label="Descripción de la carga *"
                  name="descripcion_otros"
                  placeholder="Especificá el tipo de carga..."
                  required
                  icon={FileText}
                />
              </div>
            )}

            {/* Circuito predefinido (opcional): autocompleta origen, destino y km */}
            {data.circuitos.length > 0 && (
              <SelectField
                label="Circuito (opcional)"
                name="ruta_id"
                options={data.circuitos.map((c) => ({ id: c.id, label: c.label }))}
                icon={Route}
                value={selectedCircuitoId}
                onValueChange={handleCircuitoChange}
                clearable
                searchPlaceholder="Buscar circuito..."
                hint="Elegí un circuito para autocompletar origen, destino y kilómetros."
              />
            )}

            {/* Ruta Origen / Destino — autocompletado con desplegable propio.
                Al elegir un lugar de la lista, los km se recalculan al instante. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PlaceCombobox
                label="Origen"
                name="origen_nombre"
                placeholder="Escribí o elegí un lugar..."
                icon={MapPin}
                options={data.puntos_ruta}
                value={origen}
                onValueChange={setOrigen}
                onSelect={(o) => applyKmHistorico(o, destino, true)}
                error={state?.fieldErrors?.origen_nombre}
              />
              <PlaceCombobox
                label="Destino"
                name="destino_nombre"
                placeholder="Escribí o elegí un lugar..."
                icon={Flag}
                options={data.puntos_ruta}
                value={destino}
                onValueChange={setDestino}
                onSelect={(d) => applyKmHistorico(origen, d, true)}
                error={state?.fieldErrors?.destino_nombre}
              />
            </div>

            {/* Vía del viaje: Ruta 5 (directa) vs Ruta 22 (por la base) — de la
                vía dependen los km, así que al marcarla se recalculan del
                historial de ESA vía. */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Route size={13} className="text-primary" />
                ¿Por qué ruta fue?
              </span>
              <ViaSegmented value={rutaVia} onChange={handleRutaVia} />
              <input type="hidden" name="ruta_via" value={rutaVia} />
            </div>

            {/* Kms / Tonelaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputFieldWithIcon
                label="Km con carga"
                name="km_con_carga"
                type="number"
                value={kmConCarga}
                onChange={(v) => setKmManual("con", v)}
                icon={Navigation}
                error={state?.fieldErrors?.km_con_carga}
                disabled={(Number(kmVacios) || 0) > 0 && (Number(kmConCarga) || 0) === 0}
              />
              <InputFieldWithIcon
                label="Km vacíos"
                name="km_vacios"
                type="number"
                value={kmVacios}
                onChange={(v) => setKmManual("vac", v)}
                icon={Navigation}
                error={state?.fieldErrors?.km_vacios}
                disabled={(Number(kmConCarga) || 0) > 0 && (Number(kmVacios) || 0) === 0}
              />
              <InputFieldWithIcon
                label="Tonelaje (tn)"
                name="tonelaje_real"
                type="number"
                value={tonelaje}
                onChange={setTonelaje}
                icon={Scale}
                error={state?.fieldErrors?.tonelaje_real}
              />
            </div>

            {kmHistHint && (
              <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-[#0277BD] font-medium animate-in fade-in duration-200">
                <Navigation size={12} className="shrink-0" />
                {kmHistHint}
              </p>
            )}

            {/* Monto de Flete — lo precarga la tarifa del destino (editable) */}
            <InputFieldWithIcon
              label="Monto de flete (ARS)"
              name="monto_flete"
              type="number"
              value={montoFlete}
              onChange={setMontoManual}
              icon={DollarSign}
              error={state?.fieldErrors?.monto_flete}
            />
            {/* Snapshot de la tarifa que precargó el monto (vacío = cargado a mano) */}
            <input type="hidden" name="tarifa_id" value={tarifaId} />
            {importeHint && (
              <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-[#0277BD] font-medium animate-in fade-in duration-200">
                <DollarSign size={12} className="shrink-0" />
                {importeHint}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Material (opcional) */}
              <InputFieldWithIcon
                label="Material"
                name="material"
                placeholder="Ej: Cemento, Clinker, Arena (opcional)"
                icon={Package}
                error={state?.fieldErrors?.material}
              />

              {/* Nº de viaje (opcional) — remito / comprobante, no es solo de YPF */}
              <InputFieldWithIcon
                label="Nº de viaje"
                name="nro_viaje_ypf"
                placeholder="Ej: 123456 (opcional)"
                icon={Hash}
                error={state?.fieldErrors?.nro_viaje_ypf}
              />
            </div>

            {/* Tramos siguientes: la salida sigue después de la ida. Se
                cargan todos en el mismo submit — o entran todos o no entra
                ninguno. */}
            <div className="rounded-xl border border-border bg-muted/20 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="flex flex-col">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <RotateCcw size={15} className="text-primary" />
                    Resto de la salida
                  </span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    Sumá los tramos que siguen: la vuelta vacía, otra carga en el camino, lo que sea.
                    Cada tramo arranca donde terminó el anterior.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={agregarTramo}
                  disabled={tramos.length >= MAX_TRAMOS_UI}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-40"
                >
                  <Plus size={13} className="text-primary" />
                  Agregar tramo
                </button>
              </div>

              <input type="hidden" name="tramos_count" value={tramos.length} />

              {tramos.length === 0 ? (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  Sin tramos extra: se carga solo el viaje de arriba.
                </p>
              ) : (
                <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {tramos.map((t, i) => (
                    <div key={t.id} className="rounded-lg border border-[#0088D1]/40 bg-[#0088D1]/5 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0277BD]">Tramo {i + 2}</span>
                        <button
                          type="button"
                          onClick={() => quitarTramo(t.id)}
                          aria-label={`Quitar tramo ${i + 2}`}
                          className="-m-2 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-[#EF4444]"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <input type="hidden" name={`tramo_${i}_modo`} value={t.modo} />

                      {/* Va vacío / va cargado */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          { v: "vacio", label: "Va vacío", sub: "Sin flete ni carga", Icon: PackageX },
                          { v: "cargado", label: "Va cargado", sub: "Lleva otra carga", Icon: PackageCheck },
                        ] as const).map((opt) => {
                          const active = t.modo === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setTramoModo(t, opt.v)}
                              aria-pressed={active}
                              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                                active
                                  ? "border-[#0088D1] bg-[#0088D1]/10 ring-1 ring-[#0088D1]/30"
                                  : "border-border bg-card hover:bg-muted/40"
                              }`}
                            >
                              <opt.Icon size={16} className={active ? "text-[#0277BD]" : "text-muted-foreground"} />
                              <span className="flex flex-col">
                                <span className={`text-xs font-semibold ${active ? "text-[#0277BD]" : "text-foreground"}`}>
                                  {opt.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{opt.sub}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PlaceCombobox
                          label="Origen"
                          name={`tramo_${i}_origen_nombre`}
                          placeholder="Escribí o elegí un lugar..."
                          icon={MapPin}
                          options={data.puntos_ruta}
                          value={t.origen}
                          onValueChange={(v) => setTramo(t.id, { origen: v })}
                          onSelect={(o) => applyTramoKm(t.id, o, t.destino, t.modo, t.via)}
                          error={state?.fieldErrors?.[`tramo_${i}_origen_nombre`]}
                        />
                        <PlaceCombobox
                          label="Destino"
                          name={`tramo_${i}_destino_nombre`}
                          placeholder="Escribí o elegí un lugar..."
                          icon={Flag}
                          options={data.puntos_ruta}
                          value={t.destino}
                          onValueChange={(v) => setTramo(t.id, { destino: v })}
                          onSelect={(d) => applyTramoKm(t.id, t.origen, d, t.modo, t.via)}
                          error={state?.fieldErrors?.[`tramo_${i}_destino_nombre`]}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Route size={13} className="text-primary" />
                          ¿Por qué ruta va?
                        </span>
                        <ViaSegmented value={t.via} onChange={(v) => setTramoVia(t, v)} />
                        <input type="hidden" name={`tramo_${i}_ruta_via`} value={t.via} />
                      </div>

                      {t.modo === "cargado" ? (
                        <>
                          {/* Una pata cargada no tiene km vacíos. */}
                          <input type="hidden" name={`tramo_${i}_km_vacios`} value="0" />
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputFieldWithIcon
                              label="Km con carga"
                              name={`tramo_${i}_km_con_carga`}
                              type="number"
                              value={t.kmConCarga}
                              onChange={(v) => setTramoKmManual(t, "con", v)}
                              icon={Navigation}
                              error={state?.fieldErrors?.[`tramo_${i}_km_con_carga`]}
                            />
                            <InputFieldWithIcon
                              label="Tonelaje (tn)"
                              name={`tramo_${i}_tonelaje_real`}
                              type="number"
                              value={t.tonelaje}
                              onChange={(v) => setTramo(t.id, { tonelaje: v })}
                              icon={Scale}
                              error={state?.fieldErrors?.[`tramo_${i}_tonelaje_real`]}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <InputFieldWithIcon
                              label="Material"
                              name={`tramo_${i}_material`}
                              placeholder="Ej: Arena (opcional)"
                              value={t.material}
                              onChange={(v) => setTramo(t.id, { material: v })}
                              icon={Package}
                              error={state?.fieldErrors?.[`tramo_${i}_material`]}
                            />
                            <InputFieldWithIcon
                              label="Monto de flete (ARS)"
                              name={`tramo_${i}_monto_flete`}
                              type="number"
                              value={t.monto}
                              onChange={(v) => setTramo(t.id, { monto: v })}
                              icon={DollarSign}
                              error={state?.fieldErrors?.[`tramo_${i}_monto_flete`]}
                            />
                            <InputFieldWithIcon
                              label="Nº de viaje"
                              name={`tramo_${i}_nro_viaje_ypf`}
                              placeholder="Opcional"
                              value={t.nroYpf}
                              onChange={(v) => setTramo(t.id, { nroYpf: v })}
                              icon={Hash}
                              error={state?.fieldErrors?.[`tramo_${i}_nro_viaje_ypf`]}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <input type="hidden" name={`tramo_${i}_km_con_carga`} value="0" />
                          <input type="hidden" name={`tramo_${i}_tonelaje_real`} value="0" />
                          <input type="hidden" name={`tramo_${i}_monto_flete`} value="0" />
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputFieldWithIcon
                              label="Km recorridos (vacío)"
                              name={`tramo_${i}_km_vacios`}
                              type="number"
                              value={t.kmVacios}
                              onChange={(v) => setTramoKmManual(t, "vac", v)}
                              icon={Navigation}
                              error={state?.fieldErrors?.[`tramo_${i}_km_vacios`]}
                            />
                          </div>
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <PackageX size={12} className="shrink-0" />
                            Un tramo vacío no factura ni suma tonelaje.
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {state?.error && (
              <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-xs rounded-lg px-3 py-2 font-medium">
                {state.error}
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                Cancelar
              </button>
              <SubmitButton />
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Subcomponente Input con Icono incorporado
function InputFieldWithIcon({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  value,
  onChange,
  error,
  icon: Icon,
  list,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  icon: LucideIcon;
  list?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className={`relative flex items-center h-10 w-full rounded-lg border overflow-hidden focus-within:ring-2 transition-all ${
        disabled
          ? "bg-muted/40 opacity-60 border-border"
          : error
          ? "bg-card border-red-300 focus-within:ring-red-100 focus-within:border-red-500"
          : "bg-card border-border focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]"
      }`}>
        <div className="flex items-center justify-center w-10 h-full border-r border-border bg-muted/50 text-primary shrink-0">
          <Icon size={15} />
        </div>
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          {...(value !== undefined
            ? { value, onChange: (e) => onChange?.(e.target.value) }
            : { defaultValue })}
          list={list}
          className="flex-1 h-full px-3 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-foreground disabled:cursor-not-allowed"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Boton de submit estilizado
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-[#0088D1] hover:bg-[#0277BD] text-white flex items-center justify-center gap-1.5 h-10 w-full sm:w-auto px-6 rounded-lg text-sm font-bold shadow-sm hover:shadow transition-all disabled:opacity-50"
    >
      {pending ? (
        "Guardando..."
      ) : (
        <>
          <Check size={16} strokeWidth={2.5} /> Guardar viaje
        </>
      )}
    </button>
  );
}
