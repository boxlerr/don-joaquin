"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import EditarChoferDialog from "./EditarChoferDialog";
import { Edit, Phone, Mail, MapPin, Calendar, Clock, AlertCircle, LogOut, FileText, Check } from "lucide-react";
import type { ChoferDetail } from "./types";
import { createClient } from "@/lib/supabase/client";
import { marcarAlertasVistas } from "@/app/(dashboard)/notificaciones/actions";

interface Props {
  chofer: ChoferDetail;
  onRefresh: () => void;
}

export default function ChoferHeader({ chofer, onRefresh }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

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
  const periodoPrueba = !esBaja ? diasRestantesPeriodoPrueba(chofer.fecha_ingreso) : null;
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
          <div className="w-14 h-14 rounded-full bg-[#E1F5FE] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#B3E5FC]">
            {fotoUrl ? (
              <img src={fotoUrl} alt={`${chofer.nombre} ${chofer.apellido}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="text-primary text-xl font-bold">{initials}</span>
            )}
          </div>
          <div>
            <h1 className="text-foreground text-xl font-semibold">
              {chofer.apellido}, {chofer.nombre}
            </h1>
            <p className="text-muted-foreground text-sm font-mono mt-0.5">DNI {chofer.dni}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge label={estadoLabel} tone={estadoTone} />
              {periodoPrueba !== null && periodoPrueba > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium px-2 py-0.5">
                  <AlertCircle size={11} />
                  Período de prueba: quedan {periodoPrueba} {periodoPrueba === 1 ? "día" : "días"}
                </span>
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

        <Button
          variant="outline"
          size="sm"
          className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40 flex-shrink-0"
          onClick={() => setEditOpen(true)}
        >
          <Edit size={13} className="mr-1.5 text-primary" />
          Editar
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-5 gap-3">
        <InfoItem icon={<Phone size={13} />} label={chofer.telefono ?? "—"} />
        <InfoItem icon={<Mail size={13} />} label={chofer.email ?? "—"} />
        <InfoItem icon={<MapPin size={13} />} label={chofer.localidad ?? "—"} />
        <InfoItem
          icon={<Calendar size={13} />}
          label={`Ingreso: ${chofer.fecha_ingreso ? new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR") : "—"}`}
        />
        <InfoItem icon={<Clock size={13} />} label={`Antigüedad: ${antiguedad}`} />
      </div>

      {/* Panel de egreso destacado — solo si está dado de baja */}
      {esBaja && (
        <div className="mt-5 p-4 bg-amber-100/60 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <LogOut size={14} className="text-amber-700 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              Información del egreso
            </h3>
          </div>
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
                {chofer.fecha_egreso
                  ? new Date(chofer.fecha_egreso).toLocaleDateString("es-AR")
                  : "—"}
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
        </div>
      )}

      <EditarChoferDialog
        chofer={chofer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onRefresh}
      />
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
