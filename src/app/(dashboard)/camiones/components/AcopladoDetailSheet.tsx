"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  Container,
  CircleDot,
  Wrench,
  Calendar,
  Truck,
  MapPin,
  Loader2,
  Save,
  Check,
  Pencil,
  User,
} from "lucide-react";
import {
  getRoturasAcopladoAction,
  updateAcopladoAction,
  setCamionDeAcopladoAction,
  type RoturaCamionRecord,
} from "../actions";
import type { Acoplado, Camion, AcopladoTipo } from "../types";
import { ACOPLADO_TIPO_LABELS } from "../types";
import type { Database } from "@/types/database";

type AcopladoEstado = Database["public"]["Enums"]["acoplado_estado"];

const ESTADO_LABELS: Record<AcopladoEstado, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  en_mantenimiento: "En mantenimiento",
  baja: "Baja",
};

const ESTADO_STYLES: Record<string, string> = {
  activo: "bg-[#ECFDF5] text-[#065F46] font-medium",
  en_mantenimiento: "bg-[#FEF3C7] text-[#92400E] font-medium",
  inactivo: "bg-muted text-muted-foreground font-medium",
  baja: "bg-[#FEF2F2] text-[#7F1D1D] font-medium",
};

const ESTADO_DOT: Record<string, string> = {
  activo: "bg-[#10B981]",
  en_mantenimiento: "bg-[#F59E0B]",
  inactivo: "bg-[#94A3B8]",
  baja: "bg-[#EF4444]",
};

/** Sin tipo cargado: los 64 acoplados venían con la columna vacía. */
const SIN_TIPO = "__sin_tipo__";

type FormAcoplado = {
  patente: string;
  marca: string;
  modelo: string;
  ano: string;
  capacidad: string;
  tipo: AcopladoTipo | null;
  es_tolva: boolean;
  estado: AcopladoEstado;
};

type ServicioAcoplado = {
  id: string;
  fecha: string;
  nombre: string;
  costo: number | null;
  taller: string | null;
};

type Tab = "info" | "roturas" | "services";

const ANIO_MAX = new Date().getFullYear() + 1;

function formDe(a: Acoplado): FormAcoplado {
  return {
    patente: a.patente ?? "",
    marca: a.marca ?? "",
    modelo: a.modelo ?? "",
    ano: a.ano != null ? String(a.ano) : "",
    capacidad: a.capacidad_tn != null ? String(Number(a.capacidad_tn)) : "",
    tipo: (a.tipo as AcopladoTipo | null) ?? null,
    es_tolva: !!a.es_tolva,
    estado: a.estado as AcopladoEstado,
  };
}

function igual(a: FormAcoplado, b: FormAcoplado): boolean {
  return (
    a.patente === b.patente &&
    a.marca === b.marca &&
    a.modelo === b.modelo &&
    a.ano === b.ano &&
    a.capacidad === b.capacidad &&
    a.tipo === b.tipo &&
    a.es_tolva === b.es_tolva &&
    a.estado === b.estado
  );
}

/**
 * Detalle del acoplado. Sigue la misma forma que el del camión —cabecera con la
 * patente, solapas, formulario siempre editable y un pie con Guardar— en vez de
 * la ficha de sólo lectura con botón "Editar" que tenía antes.
 *
 * La novedad es el panel "Equipo": el camión al que está enganchado se cambia
 * acá. Nico lo pidió el 01/09: "eso lo tendríamos que poder editar al igual que
 * los chasis, porque cada tanto sale algún cambio".
 */
export default function AcopladoDetailSheet({
  acoplado,
  camiones,
  open,
  onOpenChange,
}: {
  acoplado: Acoplado;
  /** La flota de chasis, para poder cambiar a cuál está enganchado. */
  camiones: Camion[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("info");
  const [roturas, setRoturas] = useState<RoturaCamionRecord[]>([]);
  const [servicios, setServicios] = useState<ServicioAcoplado[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Copia local para reflejar lo guardado sin esperar el refresh del server
  // component (el prop `acoplado` queda como estaba al abrir).
  const [local, setLocal] = useState<Acoplado>(acoplado);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [form, setForm] = useState<FormAcoplado>(() => formDe(acoplado));
  const [inicial, setInicial] = useState<FormAcoplado>(() => formDe(acoplado));

  // Enganche al camión
  const [editandoCamion, setEditandoCamion] = useState(false);
  const [camionElegido, setCamionElegido] = useState<string>("");
  const [guardandoCamion, setGuardandoCamion] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRoturasAcopladoAction(acoplado.id, 0);
      setRoturas(res.data);
      setServicios(res.servicios);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [acoplado.id]);

  useEffect(() => {
    if (open) {
      const fresh = formDe(acoplado);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir
      setTab("info");
      setLoaded(false);
      setRoturas([]);
      setServicios([]);
      setLocal(acoplado);
      setForm(fresh);
      setInicial(fresh);
      setEditandoCamion(false);
      setFeedback(null);
    }
  }, [acoplado, open]);

  const handleTab = (t: Tab) => {
    setTab(t);
    if ((t === "roturas" || t === "services") && !loaded) fetchData();
  };

  const sucio = !igual(form, inicial);

  const campoClase = (dirty: boolean) =>
    dirty ? "border-[#BAE6FD] focus-visible:ring-[#0088D1]/40" : "";

  const handleGuardar = async () => {
    const patente = form.patente.trim().toUpperCase();
    if (!patente) {
      setFeedback({ type: "error", msg: "La patente no puede quedar vacía." });
      return;
    }
    const ano = form.ano.trim() === "" ? null : Number(form.ano);
    if (ano !== null && (!Number.isInteger(ano) || ano < 1960 || ano > ANIO_MAX)) {
      setFeedback({ type: "error", msg: `El año tiene que estar entre 1960 y ${ANIO_MAX}.` });
      return;
    }
    const capacidad = form.capacidad.trim() === "" ? null : Number(form.capacidad.replace(",", "."));
    if (capacidad !== null && (!Number.isFinite(capacidad) || capacidad <= 0)) {
      setFeedback({ type: "error", msg: "La capacidad debe ser un número mayor a 0." });
      return;
    }
    const patch = {
      patente,
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      ano,
      capacidad_tn: capacidad,
      tipo: form.tipo,
      es_tolva: form.es_tolva,
      estado: form.estado,
    };
    setSaving(true);
    setFeedback(null);
    try {
      const res = await updateAcopladoAction(local.id, patch);
      if (res?.error) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      setLocal({ ...local, ...patch });
      const guardado = { ...form, patente };
      setForm(guardado);
      setInicial(guardado);
      setFeedback({ type: "success", msg: "Cambios guardados." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const guardarCamion = async () => {
    setGuardandoCamion(true);
    setFeedback(null);
    try {
      const res = await setCamionDeAcopladoAction(local.id, camionElegido || null);
      if ("error" in res) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      setLocal({
        ...local,
        camion_id_vinculado: camionElegido || null,
        camion_patente: res.camion_patente,
        chofer_nombre: camionElegido
          ? camiones.find((c) => c.id === camionElegido)?.chofer_nombre ?? null
          : null,
      });
      setEditandoCamion(false);
      setFeedback({
        type: "success",
        msg: res.camion_patente
          ? `Enganchado a ${res.camion_patente}.`
          : "El acoplado quedó suelto.",
      });
      router.refresh();
    } finally {
      setGuardandoCamion(false);
    }
  };

  /** Verde = el chasis no lleva acoplado · ámbar = ya tiene uno enganchado. */
  const opcionesCamion = useMemo<ComboboxOption[]>(
    () =>
      camiones
        .filter((c) => c.estado === "activo" || c.id === local.camion_id_vinculado)
        .map((c) => {
          const yaTiene = (c.acoplados_vinculados ?? []).filter(
            (p) => p !== local.patente,
          );
          return yaTiene.length > 0
            ? {
                id: c.id,
                label: c.patente,
                tone: "busy" as const,
                note: yaTiene.join(", "),
              }
            : { id: c.id, label: c.patente, tone: "free" as const };
        }),
    [camiones, local.camion_id_vinculado, local.patente],
  );

  const tabs: { id: Tab; label: string; icon: typeof Container }[] = [
    { id: "info", label: "Información", icon: Container },
    { id: "roturas", label: "Roturas", icon: CircleDot },
    { id: "services", label: "Services", icon: Wrench },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && sucio && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
        onOpenChange(v);
      }}
    >
      {/* Mismo formato que el detalle del camión: alto fijo en escritorio y
          pantalla completa en el celular. */}
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[900px] sm:h-[min(84dvh,820px)] p-0 sm:p-0 gap-0 overflow-hidden grid-rows-[auto_auto_1fr_auto] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none"
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Badge
              variant="outline"
              className="bg-muted/40 text-muted-foreground font-mono border-border text-xs"
            >
              ID: {local.id.slice(0, 8)}
            </Badge>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                ESTADO_STYLES[local.estado] ?? ""
              }`}
            >
              <span className={`size-2 rounded-full ${ESTADO_DOT[local.estado] ?? "bg-muted"}`} />
              {ESTADO_LABELS[local.estado as AcopladoEstado] ?? local.estado}
            </span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="w-9 h-9 rounded-lg bg-[#0088D1]/10 flex items-center justify-center text-primary shrink-0">
              <Container size={20} />
            </div>
            <span className="min-w-0 truncate font-mono">{local.patente}</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm mt-0.5">
            {local.marca ? (
              <>
                {local.marca} {local.modelo ?? ""}
                {local.ano ? ` — ${local.ano}` : ""}
              </>
            ) : (
              <span className="italic">Acoplado / semirremolque — sin marca cargada</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center px-4 sm:px-6 border-b border-border bg-muted/40 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTab(t.id)}
              className={`flex shrink-0 items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t.id
                  ? "text-primary border-[#0088D1]"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6 bg-card">
          {feedback && (
            <div className="mb-4">
              <InlineFeedback
                variant={feedback.type}
                message={feedback.msg}
                onDismiss={() => setFeedback(null)}
                autoHideMs={feedback.type === "error" ? 0 : undefined}
              />
            </div>
          )}

          {tab === "info" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6 lg:items-start">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Patente</Label>
                    <Input
                      value={form.patente}
                      onChange={(e) =>
                        setForm({ ...form, patente: e.target.value.toUpperCase() })
                      }
                      placeholder="AA123BB"
                      className={`font-mono ${campoClase(form.patente !== inicial.patente)}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Estado</Label>
                    <Select
                      value={form.estado}
                      onValueChange={(v) =>
                        setForm({ ...form, estado: (v ?? form.estado) as AcopladoEstado })
                      }
                    >
                      <SelectTrigger className={`w-full ${ESTADO_STYLES[form.estado] ?? ""}`}>
                        {/* La primitiva muestra el valor crudo ("en_mantenimiento")
                            si no se le dice cómo escribirlo. */}
                        <SelectValue placeholder="Estado">
                          {(v: string) => ESTADO_LABELS[v as AcopladoEstado] ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ESTADO_LABELS) as AcopladoEstado[]).map((e) => (
                          <SelectItem key={e} value={e}>
                            <span className="inline-flex items-center gap-2">
                              <span className={`size-2 rounded-full ${ESTADO_DOT[e]}`} />
                              {ESTADO_LABELS[e]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Marca</Label>
                    <Input
                      value={form.marca}
                      onChange={(e) => setForm({ ...form, marca: e.target.value })}
                      placeholder="Ej: Salto"
                      className={campoClase(form.marca !== inicial.marca)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Modelo</Label>
                    <Input
                      value={form.modelo}
                      onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                      placeholder="Ej: SV3E"
                      className={campoClase(form.modelo !== inicial.modelo)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Año</Label>
                    <Input
                      type="number"
                      value={form.ano}
                      onChange={(e) => setForm({ ...form, ano: e.target.value })}
                      placeholder="2018"
                      className={campoClase(form.ano !== inicial.ano)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Capacidad (TN)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.capacidad}
                      onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                      placeholder="37.5"
                      className={campoClase(form.capacidad !== inicial.capacidad)}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 space-y-2">
                    <Label className="text-sm font-medium text-foreground">Tipo</Label>
                    <Select
                      value={form.tipo ?? SIN_TIPO}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          tipo: !v || v === SIN_TIPO ? null : (v as AcopladoTipo),
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo">
                          {(v: string) =>
                            !v || v === SIN_TIPO
                              ? "Sin especificar"
                              : ACOPLADO_TIPO_LABELS[v as AcopladoTipo] ?? v
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_TIPO}>
                          <span className="text-muted-foreground">Sin especificar</span>
                        </SelectItem>
                        {(Object.keys(ACOPLADO_TIPO_LABELS) as AcopladoTipo[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACOPLADO_TIPO_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label
                  className={`inline-flex items-center gap-2.5 h-10 px-3 rounded-lg border bg-card cursor-pointer transition-colors w-fit ${
                    form.es_tolva
                      ? "border-[#0088D1] bg-[#E1F5FE]"
                      : "border-border hover:border-[#CBD5E1]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.es_tolva}
                    onChange={(e) => setForm({ ...form, es_tolva: e.target.checked })}
                    className="size-4 accent-[#0088D1]"
                  />
                  <span className="text-sm font-medium text-foreground">Es tolva</span>
                  <span className="text-xs text-muted-foreground">
                    (lleva válvulas y disco de ruptura)
                  </span>
                </label>
              </div>

              {/* ── Equipo: a qué chasis va enganchado y quién lo maneja ────── */}
              <aside className="rounded-lg border border-border bg-muted/25 p-4 space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Equipo
                </h3>

                <section className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      Camión / chasis
                    </span>
                    {!editandoCamion && (
                      <button
                        type="button"
                        onClick={() => {
                          setCamionElegido(local.camion_id_vinculado ?? "");
                          setFeedback(null);
                          setEditandoCamion(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Pencil size={11} /> Cambiar
                      </button>
                    )}
                  </div>

                  {!editandoCamion ? (
                    local.camion_patente ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Truck size={13} className="shrink-0 text-muted-foreground" />
                        <span className="font-mono font-medium text-foreground">
                          {local.camion_patente}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        Suelto, sin camión.
                      </p>
                    )
                  ) : (
                    <div className="space-y-2">
                      <Combobox
                        value={camionElegido}
                        onValueChange={setCamionElegido}
                        options={opcionesCamion}
                        placeholder="— Sin camión —"
                        searchPlaceholder="Buscar patente..."
                        clearable
                        triggerClassName="h-9 w-full text-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        En ámbar, los chasis que ya llevan otro acoplado. El cambio queda
                        con fecha de hoy y el enganche anterior pasa al historial.
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <Button
                          type="button"
                          variant="brand"
                          size="sm"
                          onClick={guardarCamion}
                          disabled={guardandoCamion}
                          className="h-8 text-xs"
                        >
                          {guardandoCamion ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          {guardandoCamion ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditandoCamion(false)}
                          disabled={guardandoCamion}
                          className="h-8 text-xs"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-1.5 border-t border-border pt-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                    Chofer
                  </span>
                  {local.chofer_nombre ? (
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <User size={13} className="shrink-0 text-muted-foreground" />
                      {local.chofer_nombre}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      {local.camion_patente
                        ? "El camión no tiene chofer asignado."
                        : "Sin chofer: el acoplado está suelto."}
                    </p>
                  )}
                  <p className="text-[10px] italic text-muted-foreground/70">
                    El chofer sale del chasis: el acoplado no se asigna a nadie por su
                    cuenta.
                  </p>
                </section>
              </aside>
            </div>
          )}

          {tab === "roturas" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Las roturas se cargan desde el módulo Mantenimiento. Acá ves el historial
                de este acoplado.
              </p>
              {loading && roturas.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
              ) : roturas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CircleDot size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay roturas registradas.</p>
                </div>
              ) : (
                roturas.map((r) => (
                  <div key={r.id} className="rounded-[8px] border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar size={11} /> {formatFecha(r.fecha)}
                      </span>
                      <span className="text-sm font-semibold text-[#F59E0B]">
                        {r.cantidad} {r.cantidad === 1 ? "goma" : "gomas"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
                      {r.chofer_nombre && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Truck size={11} /> {r.chofer_nombre}
                        </span>
                      )}
                      {(r.posicion || r.observaciones) && (
                        <span className="text-xs text-muted-foreground">
                          {r.posicion ?? r.observaciones}
                        </span>
                      )}
                      {r.costo != null && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          ${Number(r.costo).toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "services" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Services del acoplado (gomería, cubiertas, frenos del semi). Se cargan
                desde Mantenimiento.
              </p>
              {loading && servicios.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
              ) : servicios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No hay services registrados.</p>
                </div>
              ) : (
                servicios.map((s) => (
                  <div key={s.id} className="rounded-[8px] border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar size={11} /> {formatFecha(s.fecha)}
                      </span>
                      {s.costo != null && (
                        <span className="text-xs text-muted-foreground">
                          ${Number(s.costo).toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground font-medium">{s.nombre}</p>
                    {s.taller && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground pt-2 mt-1 border-t border-border">
                        <MapPin size={11} /> {s.taller}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* `mx-0 mb-0`: el pie de la primitiva se sale con márgenes negativos que
            compensan el padding del diálogo, y acá el diálogo es `p-0`. */}
        <DialogFooter className="mx-0 mb-0 sm:mx-0 sm:mb-0 px-4 sm:px-6 py-3 sm:py-4 max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-border bg-card">
          <Button
            variant="outline"
            onClick={() => {
              if (sucio && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
              onOpenChange(false);
            }}
            disabled={saving}
          >
            Cerrar
          </Button>
          {tab === "info" && (
            <Button variant="brand" onClick={handleGuardar} disabled={saving || !sucio}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
