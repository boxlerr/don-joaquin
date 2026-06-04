"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { Combobox } from "@/components/ui/combobox";
import { Camera, Edit, Loader2, Phone, Mail, MapPin, Calendar, Clock, AlertCircle, LogOut, FileText, Check, Truck, Cake, AlertTriangle, Trash2, X } from "lucide-react";
import type { ChoferDetail } from "./types";
import { createClient } from "@/lib/supabase/client";
import { marcarAlertasVistas } from "@/app/(dashboard)/notificaciones/actions";
import { uploadFotoChoferAction, deleteFotoChoferAction } from "../actions";
import { updateEgresoAction } from "./actions";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer: ChoferDetail;
  onRefresh: () => void;
  onSelectTab?: (tabId: "documentos") => void;
  editing?: boolean;
  onEditar?: () => void;
}

export default function ChoferHeader({ chofer, onRefresh, onSelectTab, editing, onEditar }: Props) {
  const [markingRead, setMarkingRead] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edición de la información del egreso (solo para choferes dados de baja).
  const [editandoEgreso, setEditandoEgreso] = useState(false);
  const [savingEgreso, setSavingEgreso] = useState(false);
  const [egMotivo, setEgMotivo] = useState<string>(chofer.motivo_egreso ?? "");
  const [egFecha, setEgFecha] = useState<string>(chofer.fecha_egreso ?? "");
  const [egObs, setEgObs] = useState<string>(chofer.observaciones ?? "");

  const handleGuardarEgreso = async () => {
    setSavingEgreso(true);
    try {
      const res = await updateEgresoAction(chofer.id, {
        motivo_egreso: egMotivo || null,
        fecha_egreso: egFecha || null,
        observaciones: egObs.trim() || null,
      });
      if (!res.error) {
        setEditandoEgreso(false);
        onRefresh();
      }
    } finally {
      setSavingEgreso(false);
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFotoError("Solo se permiten imágenes (JPG, PNG, WEBP, GIF, HEIC).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFotoError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. Máximo 5 MB.`);
      return;
    }

    setUploadingFoto(true);
    setFotoError(null);
    try {
      const formData = new FormData();
      formData.set("chofer_id", chofer.id);
      formData.set("file", file);
      const res = await uploadFotoChoferAction(formData);
      if (res.error) setFotoError(res.error);
      else onRefresh();
    } catch (err) {
      console.error(err);
      setFotoError("No se pudo subir la foto. Probá con otra imagen o formato.");
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFotoDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingFoto(true);
    setFotoError(null);
    try {
      const res = await deleteFotoChoferAction(chofer.id);
      if (res.error) setFotoError(res.error);
      else onRefresh();
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleMarcarLeidas = async () => {
    if (!chofer.alertas || chofer.alertas.length === 0) return;
    setMarkingRead(true);
    try {
      await marcarAlertasVistas(chofer.alertas.map((a) => a.id));
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingRead(false);
    }
  };

  const initials = `${chofer.nombre[0] ?? ""}${chofer.apellido[0] ?? ""}`.toUpperCase();

  const estadoTone: "success" | "warning" | "neutral" | "error" =
    chofer.estado === "activo"
      ? "success"
      : chofer.estado === "baja"
      ? "warning"
      : "neutral";
  const estadoLabel = chofer.estado === "baja" ? "egresado" : chofer.estado;

  const esBaja = chofer.estado === "baja";
  const antiguedad = formatAntiguedad(chofer.fecha_ingreso, esBaja ? chofer.fecha_egreso : null);
  const edad = calcularEdad(chofer.fecha_nacimiento);
  const periodoPrueba = !esBaja ? diasRestantesPeriodoPrueba(chofer.fecha_ingreso) : null;
  const cumple = !esBaja ? proximoCumpleanos(chofer.fecha_nacimiento) : null;
  const docsResumen = !esBaja ? resumirVencimientos(chofer.documentos_vigencia) : null;
  const camionLabel = chofer.camion_actual
    ? [chofer.camion_actual.marca, chofer.camion_actual.patente].filter(Boolean).join(" · ")
    : null;
  const tiempoEnEmpresa =
    esBaja && chofer.fecha_ingreso && chofer.fecha_egreso
      ? formatDuracion(chofer.fecha_ingreso, chofer.fecha_egreso)
      : null;
  const observacionEgreso = obtenerObservacionEgreso(chofer.observaciones);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  return (
    <div
      className={`rounded-[8px] border shadow-sm p-6 ${
        esBaja
          ? "bg-amber-50/40 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0 group/avatar">
            <div
              className="w-14 h-14 rounded-full bg-[#E1F5FE] flex items-center justify-center overflow-hidden border border-[#B3E5FC] cursor-pointer relative"
              onClick={() => fileInputRef.current?.click()}
              title={fotoUrl ? "Hacer clic para cambiar la foto" : "Hacer clic para subir una foto"}
            >
              {fotoUrl ? (
                <img src={fotoUrl} alt={`${chofer.nombre} ${chofer.apellido}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <span className="text-primary text-xl font-bold">{initials}</span>
              )}

              <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                <Camera size={14} className="text-white" />
                <span className="text-[9px] font-medium text-white tracking-wider uppercase">
                  {fotoUrl ? "Cambiar" : "Subir"}
                </span>
              </div>

              {uploadingFoto && (
                <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                  <Loader2 size={18} className="animate-spin text-primary" />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoChange}
              />
            </div>

            {fotoUrl && !uploadingFoto && (
              <button
                type="button"
                onClick={handleFotoDelete}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md border-2 border-white opacity-0 group-hover/avatar:opacity-100 transition-opacity z-20"
                title="Eliminar foto"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
          <div>
            <h1 className="text-foreground text-xl font-semibold">
              {chofer.apellido}, {chofer.nombre}
            </h1>
            <p className="text-muted-foreground text-sm font-mono mt-0.5">DNI {chofer.dni}</p>
            {fotoError && (
              <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{fotoError}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge label={estadoLabel} tone={estadoTone} />
              {!esBaja && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full text-[11px] font-medium px-2 py-0.5 border ${
                    camionLabel
                      ? "bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300"
                      : "bg-muted/50 border-border text-muted-foreground"
                  }`}
                  title={camionLabel ? "Camión asignado actualmente" : "Sin camión asignado"}
                >
                  <Truck size={11} />
                  {camionLabel ?? "Sin camión asignado"}
                </span>
              )}
              {periodoPrueba !== null && periodoPrueba > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium px-2 py-0.5">
                  <AlertCircle size={11} />
                  Período de prueba: quedan {periodoPrueba} {periodoPrueba === 1 ? "día" : "días"}
                </span>
              )}
              {cumple && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 dark:bg-fuchsia-500/10 border border-fuchsia-200 dark:border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 text-[11px] font-medium px-2 py-0.5"
                  title={`Fecha de nacimiento: ${cumple.fechaLabel}`}
                >
                  <Cake size={11} />
                  {cumple.label}
                </span>
              )}
              {docsResumen && (
                <button
                  type="button"
                  onClick={() => onSelectTab?.("documentos")}
                  className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 border transition-all hover:scale-[1.02] cursor-pointer ${
                    docsResumen.vencidos > 0
                      ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300"
                  }`}
                  title="Ver documentación"
                >
                  <AlertTriangle size={11} />
                  {docsResumen.label}
                </button>
              )}
              {chofer.alertas && chofer.alertas.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarcarLeidas}
                  disabled={markingRead}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E0F2FE] hover:bg-[#BAE6FD]/60 dark:bg-sky-950/40 border border-[#BAE6FD] dark:border-sky-800/40 text-[#0369A1] dark:text-sky-300 text-[11px] font-extrabold transition-all shadow-sm duration-200 hover:scale-[1.02] cursor-pointer disabled:opacity-50 select-none"
                  title="Marcar todas las alertas de este legajo como leídas"
                >
                  <Check size={12} strokeWidth={3} className={markingRead ? "animate-spin" : ""} />
                  Marcar como leídas
                </button>
              )}
            </div>
          </div>
        </div>

        {!editing && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40 flex-shrink-0"
            onClick={() => onEditar?.()}
          >
            <Edit size={13} className="mr-1.5 text-primary" />
            Editar
          </Button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <InfoItem icon={<Phone size={13} />} label={chofer.telefono ?? "—"} />
        <InfoItem icon={<Mail size={13} />} label={chofer.email ?? "—"} />
        <InfoItem icon={<MapPin size={13} />} label={chofer.localidad ?? "—"} />
        <InfoItem
          icon={<Truck size={13} />}
          label={chofer.camion_actual ? `Camión: ${chofer.camion_actual.patente}` : "Sin camión"}
        />
        <InfoItem
          icon={<Calendar size={13} />}
          label={`Ingreso: ${formatFecha(chofer.fecha_ingreso)}`}
        />
        <InfoItem icon={<Clock size={13} />} label={`Antigüedad: ${antiguedad}`} />
        <InfoItem icon={<Cake size={13} />} label={`Edad: ${edad != null ? `${edad} años` : "—"}`} />
      </div>

      {/* Panel de egreso destacado — solo si está dado de baja */}
      {esBaja && (
        <div className="mt-5 p-4 bg-amber-100/60 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <LogOut size={14} className="text-amber-700 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                Información del egreso
              </h3>
            </div>
            {!editandoEgreso ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-card/60"
                onClick={() => {
                  setEgMotivo(chofer.motivo_egreso ?? "");
                  setEgFecha(chofer.fecha_egreso ?? "");
                  setEgObs(chofer.observaciones ?? "");
                  setEditandoEgreso(true);
                }}
              >
                <Edit size={12} className="mr-1.5 text-primary" /> Editar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs bg-card/60" onClick={() => setEditandoEgreso(false)} disabled={savingEgreso}>
                  <X size={12} className="mr-1" /> Cancelar
                </Button>
                <Button variant="brand" size="sm" className="h-7 text-xs" onClick={handleGuardarEgreso} disabled={savingEgreso}>
                  {savingEgreso ? "Guardando..." : <><Check size={12} className="mr-1" /> Guardar</>}
                </Button>
              </div>
            )}
          </div>
          {!editandoEgreso ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Motivo</div>
                  <div className="font-medium text-foreground capitalize">
                    {chofer.motivo_egreso ?? "No especificado"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Fecha de egreso</div>
                  <div className="font-medium text-foreground">
                    {chofer.fecha_egreso ? formatFecha(chofer.fecha_egreso) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Tiempo en la empresa</div>
                  <div className="font-medium text-foreground">{tiempoEnEmpresa ?? "—"}</div>
                </div>
              </div>
              {observacionEgreso && (
                <div className="mt-3 pt-3 border-t border-amber-300/60 dark:border-amber-500/30">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                    <FileText size={11} /> Observaciones del egreso
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{observacionEgreso}</p>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Motivo</div>
                <Combobox
                  value={egMotivo}
                  onValueChange={setEgMotivo}
                  options={[
                    { id: "", label: "— Sin especificar —" },
                    { id: "renuncia", label: "Renuncia" },
                    { id: "despido", label: "Despido" },
                    { id: "jubilacion", label: "Jubilación" },
                    { id: "otro", label: "Otro" },
                  ]}
                  searchable={false}
                  triggerClassName="h-9 w-full"
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Fecha de egreso</div>
                <input
                  type="date"
                  value={egFecha}
                  onChange={(e) => setEgFecha(e.target.value)}
                  className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
                />
              </div>
              <div className="sm:col-span-3">
                <div className="text-xs text-muted-foreground mb-1">Observaciones</div>
                <textarea
                  value={egObs}
                  onChange={(e) => setEgObs(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
                  placeholder="Detalle del egreso…"
                />
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function InfoItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad >= 0 && edad < 120 ? edad : null;
}

function formatAntiguedad(fechaIngreso: string | null, hasta: string | null = null): string {
  if (!fechaIngreso) return "—";
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return "—";
  const hoy = hasta ? new Date(hasta) : new Date();
  if (Number.isNaN(hoy.getTime())) return "—";
  let años = hoy.getFullYear() - ingreso.getFullYear();
  let meses = hoy.getMonth() - ingreso.getMonth();
  if (hoy.getDate() < ingreso.getDate()) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  if (años <= 0 && meses <= 0) {
    const diasMs = hoy.getTime() - ingreso.getTime();
    const dias = Math.max(0, Math.floor(diasMs / 86400000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (años <= 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (meses <= 0) return `${años} ${años === 1 ? "año" : "años"}`;
  return `${años} ${años === 1 ? "año" : "años"} ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

function formatDuracion(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return "—";
  let años = fin.getFullYear() - inicio.getFullYear();
  let meses = fin.getMonth() - inicio.getMonth();
  if (fin.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) {
    años -= 1;
    meses += 12;
  }
  if (años <= 0 && meses <= 0) {
    const dias = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 86400000));
    return `${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (años <= 0) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (meses <= 0) return `${años} ${años === 1 ? "año" : "años"}`;
  return `${años} ${años === 1 ? "año" : "años"} ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

/** Extrae la línea de observación cargada al egresar (formato "Egreso: ...") si existe. */
function obtenerObservacionEgreso(observaciones: string | null | undefined): string | null {
  if (!observaciones) return null;
  const match = observaciones
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith("egreso:"));
  if (match) return match.replace(/^egreso:\s*/i, "");
  return observaciones; // fallback: si no hay marcador, muestro todo
}

function diasRestantesPeriodoPrueba(fechaIngreso: string | null): number | null {
  if (!fechaIngreso) return null;
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return null;
  const fin = new Date(ingreso);
  fin.setMonth(fin.getMonth() + 6);
  const diff = fin.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function proximoCumpleanos(
  fechaNacimiento: string | null,
): { label: string; fechaLabel: string } | null {
  if (!fechaNacimiento) return null;
  // Parseo manual para evitar que YYYY-MM-DD sea interpretado como UTC y se corra un día.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (!match) return null;
  const nacMes = parseInt(match[2], 10) - 1;
  const nacDia = parseInt(match[3], 10);
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let proximo = new Date(hoy.getFullYear(), nacMes, nacDia);
  if (proximo.getTime() < inicioHoy.getTime()) {
    proximo = new Date(hoy.getFullYear() + 1, nacMes, nacDia);
  }
  const dias = Math.round((proximo.getTime() - inicioHoy.getTime()) / 86400000);
  const fechaLabel = `${String(nacDia).padStart(2, "0")}/${String(nacMes + 1).padStart(2, "0")}`;
  if (dias === 0) return { label: "Cumple hoy 🎉", fechaLabel };
  if (dias <= 30)
    return { label: `Cumple en ${dias} ${dias === 1 ? "día" : "días"}`, fechaLabel };
  return null;
}

function resumirVencimientos(
  documentos: { dias_restantes: number | null }[] | undefined,
): { label: string; vencidos: number; proximos: number } | null {
  if (!documentos || documentos.length === 0) return null;
  let vencidos = 0;
  let proximos = 0;
  for (const doc of documentos) {
    const d = doc.dias_restantes;
    if (d === null || d === undefined) continue;
    if (d < 0) vencidos += 1;
    else if (d <= 30) proximos += 1;
  }
  if (vencidos === 0 && proximos === 0) return null;
  const partes: string[] = [];
  if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos === 1 ? "" : "s"}`);
  if (proximos > 0) partes.push(`${proximos} por vencer`);
  return { label: partes.join(" · "), vencidos, proximos };
}
