"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/ui/StatusBadge";
import InlineFeedback from "@/components/ui/InlineFeedback";
import { Container, CircleDot, Wrench, Calendar, Truck, MapPin, Pencil, Loader2 } from "lucide-react";
import EstadoSwitch from "./EstadoSwitch";
import { getRoturasAcopladoAction, updateAcopladoAction, type RoturaCamionRecord } from "../actions";
import type { Acoplado } from "../types";
import type { Database } from "@/types/database";

type AcopladoTipo = Database["public"]["Enums"]["acoplado_tipo"];
type AcopladoEstado = Database["public"]["Enums"]["acoplado_estado"];

const TIPO_LABELS: Record<AcopladoTipo, string> = {
  semi_tolva: "Semi tolva",
  batea: "Batea",
  sider: "Sider",
  semi_furgon: "Semi furgón",
  cisterna: "Cisterna",
  jaula: "Jaula",
  plancha: "Plancha",
  otro: "Otro",
};

const ESTADO_LABELS: Record<AcopladoEstado, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  en_mantenimiento: "En mantenimiento",
  baja: "Baja",
};

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

function fmtFecha(iso: string): string {
  return formatFecha(iso);
}

export default function AcopladoDetailSheet({
  acoplado,
  open,
  onOpenChange,
}: {
  acoplado: Acoplado;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("info");
  const [roturas, setRoturas] = useState<RoturaCamionRecord[]>([]);
  const [servicios, setServicios] = useState<ServicioAcoplado[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Copia local para reflejar los cambios guardados sin esperar el refresh del
  // server component (el prop `acoplado` queda como estaba al abrir).
  const [local, setLocal] = useState<Acoplado>(acoplado);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [form, setForm] = useState<FormAcoplado>({
    patente: "",
    marca: "",
    modelo: "",
    ano: "",
    capacidad: "",
    tipo: null,
    es_tolva: false,
    estado: "activo",
  });

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setTab("info");
      setLoaded(false);
      setRoturas([]);
      setServicios([]);
      setLocal(acoplado);
      setEditando(false);
      setFeedback(null);
    }
  }, [acoplado, open]);

  const handleTab = (t: Tab) => {
    setTab(t);
    if ((t === "roturas" || t === "services") && !loaded) fetchData();
  };

  const startEdit = () => {
    setForm({
      patente: local.patente ?? "",
      marca: local.marca ?? "",
      modelo: local.modelo ?? "",
      ano: local.ano != null ? String(local.ano) : "",
      capacidad: local.capacidad_tn != null ? String(Number(local.capacidad_tn)) : "",
      tipo: (local.tipo as AcopladoTipo | null) ?? null,
      es_tolva: !!local.es_tolva,
      estado: local.estado as AcopladoEstado,
    });
    setFeedback(null);
    setEditando(true);
  };

  const handleGuardar = async () => {
    const patente = form.patente.trim().toUpperCase();
    if (!patente) {
      setFeedback({ type: "error", msg: "La patente no puede quedar vacía." });
      return;
    }
    const ano = form.ano.trim() === "" ? null : Number(form.ano);
    if (ano !== null && (!Number.isInteger(ano) || ano < 1960 || ano > new Date().getFullYear() + 1)) {
      setFeedback({ type: "error", msg: "El año ingresado no es válido." });
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
    try {
      const res = await updateAcopladoAction(local.id, patch);
      if (res?.error) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      setLocal({ ...local, ...patch });
      setEditando(false);
      setFeedback({ type: "success", msg: "Acoplado actualizado." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  // Switch rápido del header: activo ⇄ inactivo sin entrar al modo edición.
  const toggleEstadoRapido = async () => {
    const nuevo: AcopladoEstado = local.estado === "activo" ? "inactivo" : "activo";
    setSwitchPending(true);
    try {
      const res = await updateAcopladoAction(local.id, { estado: nuevo });
      if (res?.error) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      setLocal({ ...local, estado: nuevo });
      router.refresh();
    } finally {
      setSwitchPending(false);
    }
  };

  const datosCompletos = !!local.marca;

  const tabs: { id: Tab; label: string; icon: typeof Container }[] = [
    { id: "info", label: "Información", icon: Container },
    { id: "roturas", label: "Roturas", icon: CircleDot },
    { id: "services", label: "Services", icon: Wrench },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl flex items-center gap-2">
            <Container size={18} className="text-muted-foreground" />
            <span className="font-mono">{local.patente}</span>
            <StatusBadge label={ESTADO_LABELS[local.estado as AcopladoEstado] ?? local.estado} tone={local.estado === "activo" ? "success" : "neutral"} />
            <span className="ml-auto mr-2">
              <EstadoSwitch
                activo={local.estado === "activo"}
                pending={switchPending}
                onToggle={toggleEstadoRapido}
              />
            </span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {datosCompletos ? `${local.marca} ${local.modelo ?? ""}`.trim() : "Acoplado / semirremolque"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-[#0088D1] text-[#0088D1]" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {feedback && (
            <div className="mb-3">
              <InlineFeedback
                variant={feedback.type}
                message={feedback.msg}
                onDismiss={() => setFeedback(null)}
              />
            </div>
          )}

          {tab === "info" && !editando && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEdit}
                  className="text-muted-foreground border-border hover:bg-muted/40"
                >
                  <Pencil size={13} /> Editar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="Patente" value={local.patente} mono />
                <Info label="Marca" value={local.marca || "Sin datos"} />
                <Info label="Modelo" value={local.modelo || "—"} />
                <Info label="Año" value={local.ano != null ? String(local.ano) : "—"} />
                <Info label="Capacidad" value={local.capacidad_tn != null ? `${Number(local.capacidad_tn).toFixed(1)} TN` : "—"} />
                <Info label="Tipo" value={local.tipo ? (TIPO_LABELS[local.tipo as AcopladoTipo] ?? local.tipo) : "—"} />
                <Info label="Tolva" value={local.es_tolva ? "Sí" : "No"} />
                <Info label="Camión asignado" value={local.camion_patente || "Sin camión"} mono={!!local.camion_patente} />
                <Info label="Chofer" value={local.chofer_nombre || "Sin chofer"} />
              </div>
            </div>
          )}

          {tab === "info" && editando && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patente">
                  <Input
                    value={form.patente}
                    onChange={(e) => setForm({ ...form, patente: e.target.value.toUpperCase() })}
                    className="h-9 font-mono uppercase"
                    placeholder="AA123BB"
                  />
                </Field>
                <Field label="Año">
                  <Input
                    type="number"
                    value={form.ano}
                    onChange={(e) => setForm({ ...form, ano: e.target.value })}
                    className="h-9"
                    placeholder="Ej: 2018"
                  />
                </Field>
                <Field label="Marca">
                  <Input
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    className="h-9"
                    placeholder="Ej: Salto"
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    className="h-9"
                    placeholder="Ej: SV3E"
                  />
                </Field>
                <Field label="Capacidad (TN)">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.capacidad}
                    onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                    className="h-9"
                    placeholder="Ej: 37.5"
                  />
                </Field>
                <Field label="¿Es tolva?">
                  <div className="flex gap-1.5">
                    <Chip active={form.es_tolva} onClick={() => setForm({ ...form, es_tolva: true })}>
                      Sí
                    </Chip>
                    <Chip active={!form.es_tolva} onClick={() => setForm({ ...form, es_tolva: false })}>
                      No
                    </Chip>
                  </div>
                </Field>
              </div>

              <Field label="Tipo">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TIPO_LABELS) as AcopladoTipo[]).map((t) => (
                    <Chip
                      key={t}
                      active={form.tipo === t}
                      onClick={() => setForm({ ...form, tipo: form.tipo === t ? null : t })}
                    >
                      {TIPO_LABELS[t]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Field label="Estado">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ESTADO_LABELS) as AcopladoEstado[]).map((s) => (
                    <Chip key={s} active={form.estado === s} onClick={() => setForm({ ...form, estado: s })}>
                      {ESTADO_LABELS[s]}
                    </Chip>
                  ))}
                </div>
              </Field>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setEditando(false)}
                  disabled={saving}
                  className="text-muted-foreground border-border hover:bg-muted/40"
                >
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleGuardar} disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          )}

          {tab === "roturas" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Las roturas se cargan desde el módulo Mantenimiento. Acá ves el historial de este acoplado.
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
                        <Calendar size={11} /> {fmtFecha(r.fecha)}
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
                        <span className="text-xs text-muted-foreground">{r.posicion ?? r.observaciones}</span>
                      )}
                      {r.costo != null && (
                        <span className="text-xs text-muted-foreground ml-auto">${Number(r.costo).toLocaleString("es-AR")}</span>
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
                Services del acoplado (gomería, cubiertas, frenos del semi). Se cargan desde Mantenimiento.
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
                        <Calendar size={11} /> {fmtFecha(s.fecha)}
                      </span>
                      {s.costo != null && (
                        <span className="text-xs text-muted-foreground">${Number(s.costo).toLocaleString("es-AR")}</span>
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

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-muted-foreground border-border hover:bg-muted/40">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// Chip seleccionable (reemplaza selects nativos, que se ven mal en mac).
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 h-8 rounded-md border text-xs font-medium transition-colors ${
        active
          ? "bg-[#E1F5FE] border-[#0088D1] text-[#0369A1]"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}
