"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import EditarChoferDialog from "./EditarChoferDialog";
import { Edit, Phone, Mail, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import type { ChoferDetail } from "./types";
import { createClient } from "@/lib/supabase/client";

interface Props {
  chofer: ChoferDetail;
  onRefresh: () => void;
}

export default function ChoferHeader({ chofer, onRefresh }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  const initials = `${chofer.nombre[0] ?? ""}${chofer.apellido[0] ?? ""}`.toUpperCase();

  const estadoTone =
    chofer.estado === "activo"
      ? "success"
      : chofer.estado === "baja"
      ? "error"
      : "neutral";

  const antiguedad = formatAntiguedad(chofer.fecha_ingreso);
  const periodoPrueba = diasRestantesPeriodoPrueba(chofer.fecha_ingreso);

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm p-6">
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
              <StatusBadge label={chofer.estado} tone={estadoTone} />
              {periodoPrueba !== null && periodoPrueba > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-medium px-2 py-0.5">
                  <AlertCircle size={11} />
                  Período de prueba: quedan {periodoPrueba} {periodoPrueba === 1 ? "día" : "días"}
                </span>
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
          label={`Ingreso: ${new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}`}
        />
        <InfoItem icon={<Clock size={13} />} label={`Antigüedad: ${antiguedad}`} />
      </div>

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

function formatAntiguedad(fechaIngreso: string | null): string {
  if (!fechaIngreso) return "—";
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return "—";
  const hoy = new Date();
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

function diasRestantesPeriodoPrueba(fechaIngreso: string | null): number | null {
  if (!fechaIngreso) return null;
  const ingreso = new Date(fechaIngreso);
  if (Number.isNaN(ingreso.getTime())) return null;
  const fin = new Date(ingreso);
  fin.setMonth(fin.getMonth() + 6);
  const diff = fin.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}
