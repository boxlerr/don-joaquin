"use client";

// Ficha del candidato ("ver más"): modal GRANDE centrado (pedido 13/07) con
// todo lo del Excel de Bárbara legible de una — los campos crecen con el
// contenido (nada de texto cortado con scroll lateral) y cada pregunta va en
// negrita. Todo se edita ahí mismo con un solo botón Guardar que aparece
// cuando hay cambios; el semáforo y la etapa guardan al instante.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import AdjuntosEditable from "@/components/ui/AdjuntosEditable";
import {
  MapPin, Phone, Calendar, Loader2, IdCard, Mail, Briefcase, HeartPulse, Save, Pencil,
} from "lucide-react";
import Semaforo from "./Semaforo";
import EntrevistaFormDialog from "./EntrevistaFormDialog";
import {
  patchEntrevistaAction, setEtapaEntrevistaAction,
  getCvsAction, crearUrlSubidaCvAction, vincularCvAction, deleteCvAction,
  type EntrevistaPatch,
} from "../actions";
import type { Entrevista } from "./EntrevistasTable";

const ETAPAS = [
  { id: "entrevista", label: "Entrevista" },
  { id: "preocupacional", label: "Preocupacional" },
  { id: "ingresado", label: "Ingresó" },
  { id: "descartado", label: "Descartado" },
];

const PREOCUPACIONAL_OPCIONES = [
  { value: "no_aplica", label: "No corresponde / sin definir" },
  { value: "pendiente", label: "A realizar" },
  { value: "apto", label: "Apto" },
  { value: "no_apto", label: "No apto" },
];
const RESULTADO_OPCIONES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "ingresa", label: "Ingresa" },
  { value: "no_ingresa", label: "No ingresa" },
];

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Form = {
  observaciones: string;
  preocupacional: string;
  preocupacional_nota: string;
  resultado: string;
  motivo_descarte: string;
  aprobado: string;
  entro: string;
  se_mantuvo: string;
  telefono: string;
  dni: string;
  email: string;
  puesto: string;
  experiencia: string;
  localidad: string;
  contacto_emergencia: string;
  fecha_entrevista: string;
  edad: string;
};

const formDe = (e: Entrevista): Form => ({
  observaciones: e.observaciones ?? "",
  preocupacional: e.preocupacional ?? "no_aplica",
  preocupacional_nota: e.preocupacional_nota ?? "",
  resultado: e.resultado ?? "pendiente",
  motivo_descarte: e.motivo_descarte ?? "",
  aprobado: e.aprobado ?? "",
  entro: e.entro ?? "",
  se_mantuvo: e.se_mantuvo ?? "",
  telefono: e.telefono ?? "",
  dni: e.dni ?? "",
  email: e.email ?? "",
  puesto: e.puesto ?? "",
  experiencia: e.experiencia ?? "",
  localidad: e.localidad ?? "",
  contacto_emergencia: e.contacto_emergencia ?? "",
  fecha_entrevista: e.fecha_entrevista ?? "",
  edad: e.edad != null ? String(e.edad) : "",
});

// Textarea que crece con el contenido (field-sizing) — nada de texto cortado.
const areaCls =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y [field-sizing:content] max-h-72";

/** Pregunta / label en negrita, como pidió Julián. */
const Pregunta = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <Label htmlFor={htmlFor} className="text-sm font-bold text-foreground">
    {children}
  </Label>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h4>
);

export default function EntrevistaDrawer({
  entrevista, onClose, canWrite,
}: {
  entrevista: Entrevista | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(entrevista ? formDe(entrevista) : null);
  const [guardando, setGuardando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al cambiar de candidato, resetear el formulario durante el render (patrón
  // React de "adjusting state") — sin pisar lo tipeado si es el mismo candidato.
  const [formDeId, setFormDeId] = useState<string | null>(entrevista?.id ?? null);
  if (entrevista && entrevista.id !== formDeId) {
    setFormDeId(entrevista.id);
    setForm(formDe(entrevista));
    setError(null);
  }

  const dirty = useMemo(() => {
    if (!entrevista || !form) return false;
    const base = formDe(entrevista);
    return (Object.keys(base) as (keyof Form)[]).some((k) => base[k] !== form[k]);
  }, [entrevista, form]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const guardar = async () => {
    if (!entrevista || !form || !dirty) return;
    setGuardando(true);
    setError(null);
    const base = formDe(entrevista);
    const patch: EntrevistaPatch = {};
    for (const k of Object.keys(base) as (keyof Form)[]) {
      if (base[k] !== form[k]) (patch as Record<string, string>)[k] = form[k];
    }
    const res = await patchEntrevistaAction(entrevista.id, patch);
    setGuardando(false);
    if ("error" in res && res.error) setError(res.error);
    else router.refresh();
  };

  const moverEtapa = async (etapa: string) => {
    if (!entrevista || moviendo || etapa === (entrevista.etapa ?? "entrevista")) return;
    setMoviendo(true);
    setError(null);
    const res = await setEtapaEntrevistaAction(
      entrevista.id, etapa,
      etapa === "descartado" ? form?.motivo_descarte || undefined : undefined,
    );
    setMoviendo(false);
    if ("error" in res && res.error) setError(res.error);
    else router.refresh();
  };

  const e = entrevista;

  return (
    <Dialog open={e != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {e && form && (
          <>
            {/* Encabezado */}
            <div className="shrink-0 border-b border-border p-4 pr-12 sm:p-5 sm:pb-4 sm:pr-14">
              <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3 text-base sm:text-lg font-bold text-foreground">
                {e.nombre}
                {/* Solo lectura: la etapa se maneja acá abajo con los pills. */}
                <Semaforo entrevistaId={e.id} etapa={e.etapa} canWrite={false} />
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Calendar size={13} />{fmtFecha(e.fecha_entrevista)}</span>
                {e.edad != null && <span>{e.edad} años</span>}
                {e.localidad && <span className="inline-flex items-center gap-1"><MapPin size={13} />{e.localidad}</span>}
                {e.puesto && <span className="inline-flex items-center gap-1 font-medium text-primary"><Briefcase size={13} />{e.puesto}</span>}
              </div>
              {/* Etapa del pipeline: click para mover */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {ETAPAS.map((et) => {
                  const activa = (e.etapa ?? "entrevista") === et.id;
                  return (
                    <button
                      key={et.id}
                      type="button"
                      disabled={!canWrite || moviendo}
                      onClick={() => moverEtapa(et.id)}
                      className={`inline-flex min-h-9 items-center rounded-full px-3 py-2 text-[11px] font-semibold transition-colors disabled:cursor-default sm:min-h-0 sm:px-2.5 sm:py-1 ${
                        activa
                          ? et.id === "descartado" ? "bg-rose-600 text-white" : et.id === "ingresado" ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground"
                          : `bg-muted text-muted-foreground ${canWrite ? "hover:text-foreground" : ""}`
                      }`}
                      title={canWrite && !activa ? `Mover a ${et.label}` : et.label}
                    >
                      {et.label}
                    </button>
                  );
                })}
                {moviendo && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Cuerpo */}
            <div className="min-h-0 flex-1 space-y-5 sm:space-y-6 overflow-y-auto p-4 sm:p-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              {/* Observaciones — la nota libre de Bárbara, completa y a lo ancho */}
              <section className="space-y-1.5">
                <Pregunta htmlFor="fx-obs">Observaciones de la entrevista</Pregunta>
                <textarea
                  id="fx-obs"
                  disabled={!canWrite}
                  placeholder="Tu impresión personal: cómo lo viste, quién lo recomendó, qué te llamó la atención…"
                  value={form.observaciones}
                  onChange={(ev) => set("observaciones")(ev.target.value)}
                  className={`${areaCls} min-h-24`}
                />
              </section>

              {/* Evaluación */}
              <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <Pregunta>Preocupacional</Pregunta>
                  {canWrite ? (
                    <Select value={form.preocupacional} onValueChange={(v) => set("preocupacional")(v ?? "no_aplica")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v) => PREOCUPACIONAL_OPCIONES.find((o) => o.value === v)?.label ?? ""}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PREOCUPACIONAL_OPCIONES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{PREOCUPACIONAL_OPCIONES.find((o) => o.value === form.preocupacional)?.label}</p>
                  )}
                  <div className="space-y-1">
                    <Pregunta htmlFor="fx-preoc-nota">Detalle del preocupacional</Pregunta>
                    <textarea
                      id="fx-preoc-nota"
                      disabled={!canWrite}
                      placeholder="Cómo dio, si no se presentó…"
                      value={form.preocupacional_nota}
                      onChange={(ev) => set("preocupacional_nota")(ev.target.value)}
                      className={`${areaCls} min-h-14`}
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <Pregunta>¿Entra al transporte?</Pregunta>
                  {canWrite ? (
                    <Select value={form.resultado} onValueChange={(v) => set("resultado")(v ?? "pendiente")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v) => RESULTADO_OPCIONES.find((o) => o.value === v)?.label ?? ""}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {RESULTADO_OPCIONES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{RESULTADO_OPCIONES.find((o) => o.value === form.resultado)?.label}</p>
                  )}
                  <div className="space-y-1">
                    <Pregunta htmlFor="fx-motivo">Motivo (si no ingresa)</Pregunta>
                    <textarea
                      id="fx-motivo"
                      disabled={!canWrite}
                      placeholder="Queda registrado y se muestra en la lista…"
                      value={form.motivo_descarte}
                      onChange={(ev) => set("motivo_descarte")(ev.target.value)}
                      className={`${areaCls} min-h-14`}
                    />
                  </div>
                </div>
              </section>

              {/* Seguimiento (columnas del Excel) — con campos que crecen */}
              <section className="space-y-3">
                <SectionTitle>Seguimiento — qué pasó después</SectionTitle>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Pregunta htmlFor="fx-aprobado">¿Aprobado?</Pregunta>
                    <textarea
                      id="fx-aprobado"
                      disabled={!canWrite}
                      placeholder="Sí / No / nota"
                      value={form.aprobado}
                      onChange={(ev) => set("aprobado")(ev.target.value)}
                      className={`${areaCls} min-h-14`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta htmlFor="fx-entro">¿Entró?</Pregunta>
                    <textarea
                      id="fx-entro"
                      disabled={!canWrite}
                      placeholder="Sí / No / a otra empresa"
                      value={form.entro}
                      onChange={(ev) => set("entro")(ev.target.value)}
                      className={`${areaCls} min-h-14`}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Pregunta htmlFor="fx-mantuvo">¿Se mantuvo?</Pregunta>
                  <textarea
                    id="fx-mantuvo"
                    disabled={!canWrite}
                    placeholder="Si ingresó: sigue trabajando, renunció, por qué se fue…"
                    value={form.se_mantuvo}
                    onChange={(ev) => set("se_mantuvo")(ev.target.value)}
                    className={`${areaCls} min-h-14`}
                  />
                </div>
              </section>

              {/* Datos y contacto */}
              <section className="space-y-3">
                <SectionTitle>Datos y contacto</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Pregunta><span className="inline-flex items-center gap-1"><Phone size={12} /> Teléfono</span></Pregunta>
                    <Input disabled={!canWrite} value={form.telefono} onChange={(ev) => set("telefono")(ev.target.value)} placeholder="Para recontactar" />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta><span className="inline-flex items-center gap-1"><IdCard size={12} /> DNI</span></Pregunta>
                    <Input disabled={!canWrite} value={form.dni} onChange={(ev) => set("dni")(ev.target.value)} placeholder="Ej: 30.123.456" />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta><span className="inline-flex items-center gap-1"><Mail size={12} /> Email</span></Pregunta>
                    <Input disabled={!canWrite} type="email" value={form.email} onChange={(ev) => set("email")(ev.target.value)} placeholder="correo@ejemplo.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta><span className="inline-flex items-center gap-1"><MapPin size={12} /> De dónde es</span></Pregunta>
                    <Input disabled={!canWrite} value={form.localidad} onChange={(ev) => set("localidad")(ev.target.value)} placeholder="Localidad" />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta>Fecha de entrevista</Pregunta>
                    <Input disabled={!canWrite} type="date" value={form.fecha_entrevista} onChange={(ev) => set("fecha_entrevista")(ev.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta>Edad</Pregunta>
                    <Input disabled={!canWrite} type="number" min={14} max={99} value={form.edad} onChange={(ev) => set("edad")(ev.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta><span className="inline-flex items-center gap-1"><Briefcase size={12} /> Puesto</span></Pregunta>
                    <Input disabled={!canWrite} value={form.puesto} onChange={(ev) => set("puesto")(ev.target.value)} placeholder="Ej: Chofer volcador" />
                  </div>
                  <div className="space-y-1.5">
                    <Pregunta>Experiencia</Pregunta>
                    <Input disabled={!canWrite} value={form.experiencia} onChange={(ev) => set("experiencia")(ev.target.value)} placeholder="Ej: 5 años en carga" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Pregunta><span className="inline-flex items-center gap-1"><HeartPulse size={12} /> Contacto de emergencia</span></Pregunta>
                  <Input
                    disabled={!canWrite}
                    value={form.contacto_emergencia}
                    onChange={(ev) => set("contacto_emergencia")(ev.target.value)}
                    placeholder="Nombre y teléfono (ej: María Pérez, esposa — 2281 555555)"
                  />
                </div>
              </section>

              {/* CV / documentos */}
              <section className="space-y-2">
                <SectionTitle>CV y documentos</SectionTitle>
                <AdjuntosEditable
                  permitirFoto
                  entidadId={e.id}
                  getArchivos={getCvsAction}
                  crearUrlSubida={crearUrlSubidaCvAction}
                  vincularArchivos={vincularCvAction}
                  deleteArchivo={deleteCvAction}
                  canEdit={canWrite}
                  addLabel="Subir CV / documento"
                  emptyHint="Sin CV cargado. Subilo para tenerlo guardado y poder previsualizarlo."
                />
              </section>

              <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                Registrado el {new Date(e.created_at).toLocaleDateString("es-AR")}.
              </p>
            </div>

            {/* Barra de guardado: aparece cuando hay cambios sin guardar */}
            {canWrite && (
              <div className={`shrink-0 border-t border-border bg-card p-3 px-4 sm:px-5 transition-all ${dirty ? "" : "opacity-70"}`}>
                {/* En celular el aviso va arriba y los botones abajo, a lo ancho:
                    en una sola fila el texto y los dos botones no entran. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {dirty ? "Hay cambios sin guardar." : "Todo guardado."}
                  </p>
                  <div className="flex items-center gap-2">
                    <EntrevistaFormDialog entrevista={e}>
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 sm:flex-none">
                        <Pencil size={13} /> Editar todo
                      </Button>
                    </EntrevistaFormDialog>
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 sm:flex-none"
                      disabled={!dirty || guardando}
                      onClick={guardar}
                    >
                      {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Guardar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
