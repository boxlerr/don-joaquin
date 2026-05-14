"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import EditarChoferDialog from "./EditarChoferDialog";
import { Edit, Phone, Mail, MapPin, Calendar } from "lucide-react";
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

  const supabase = createClient();
  const fotoUrl = chofer.foto
    ? supabase.storage.from(chofer.foto.bucket).getPublicUrl(chofer.foto.path).data.publicUrl
    : null;

  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#E1F5FE] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#B3E5FC]">
            {fotoUrl ? (
              <img src={fotoUrl} alt={`${chofer.nombre} ${chofer.apellido}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#0088D1] text-xl font-bold">{initials}</span>
            )}
          </div>
          <div>
            <h1 className="text-[#0F172A] text-xl font-semibold">
              {chofer.apellido}, {chofer.nombre}
            </h1>
            <p className="text-[#64748B] text-sm font-mono mt-0.5">DNI {chofer.dni}</p>
            <div className="mt-1.5">
              <StatusBadge label={chofer.estado} tone={estadoTone} />
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC] flex-shrink-0"
          onClick={() => setEditOpen(true)}
        >
          <Edit size={13} className="mr-1.5 text-[#0088D1]" />
          Editar
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoItem icon={<Phone size={13} />} label={chofer.telefono ?? "—"} />
        <InfoItem icon={<Mail size={13} />} label={chofer.email ?? "—"} />
        <InfoItem icon={<MapPin size={13} />} label={chofer.localidad ?? "—"} />
        <InfoItem
          icon={<Calendar size={13} />}
          label={`Ingreso: ${new Date(chofer.fecha_ingreso).toLocaleDateString("es-AR")}`}
        />
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
    <div className="flex items-center gap-1.5 text-sm text-[#475569]">
      <span className="text-[#94A3B8]">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
