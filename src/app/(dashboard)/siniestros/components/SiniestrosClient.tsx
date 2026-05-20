"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, DollarSign, Calendar, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AddSiniestroDialog, { SiniestroFormPayload, SiniestroEditing } from "./AddSiniestroDialog";
import SiniestrosTable, { SiniestroConRelaciones } from "./SiniestrosTable";

interface SiniestrosClientProps {
  siniestros: SiniestroConRelaciones[];
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null }[];
}

export default function SiniestrosClient({ siniestros, camiones, choferes }: SiniestrosClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSiniestro, setEditingSiniestro] = useState<SiniestroEditing | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const handleAdd = async (data: SiniestroFormPayload) => {
    const supabase = createClient();
    const { error } = await supabase.from("siniestros").insert(data);
    if (error) { setOpError(error.message); return; }
    refresh();
  };

  const handleUpdate = async (id: string, data: SiniestroFormPayload) => {
    const supabase = createClient();
    const { error } = await supabase.from("siniestros").update(data).eq("id", id);
    if (error) { setOpError(error.message); return; }
    refresh();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("siniestros").delete().eq("id", id);
    if (error) { setOpError(error.message); return; }
    refresh();
  };

  // Estadísticas
  const totalSiniestros = siniestros.length;
  const totalMonto = siniestros.reduce((acc, s) => acc + (s.monto_danos || 0), 0);

  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const esteMes = siniestros.filter((s) => s.fecha >= startOfMonth).length;
  const camionesAfectados = new Set(siniestros.map((s) => s.camion_id)).size;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Siniestros"
        description="Historial y registro de siniestros de la flota"
        action={
          <Button
            variant="brand"
            className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2 h-10 px-4 rounded-lg font-semibold shadow-sm transition-all hover:shadow"
            onClick={() => {
              setEditingSiniestro(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} strokeWidth={2.5} /> Registrar Siniestro
          </Button>
        }
      />

      {opError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {opError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Total Siniestros" value={totalSiniestros.toString()} sub="Registrados en el sistema" color="brand" icon={AlertTriangle} variant="dashboard" />
        <StatCard label="Costo Daños Estimado" value={`$ ${totalMonto.toLocaleString("es-AR")}`} sub="Monto acumulado registrado" color="error" icon={DollarSign} variant="dashboard" />
        <StatCard label="Siniestros Este Mes" value={esteMes.toString()} sub="Ocurridos en el mes en curso" color="warning" icon={Calendar} variant="dashboard" />
        <StatCard label="Camiones Afectados" value={camionesAfectados.toString()} sub="Unidades con al menos 1 siniestro" color="success" icon={Truck} variant="dashboard" />
      </div>

      <SiniestrosTable
        siniestros={siniestros}
        camiones={camiones}
        choferes={choferes}
        onEdit={(s) => {
          setEditingSiniestro({
            id: s.id,
            camion_id: s.camion_id,
            chofer_id: s.chofer_id,
            fecha: s.fecha,
            tipo_siniestro: s.tipo_siniestro,
            estado: s.estado,
            descripcion: s.descripcion,
            monto_danos: s.monto_danos,
            compania_seguro: s.compania_seguro ?? "",
            numero_siniestro_seguro: s.numero_siniestro_seguro ?? "",
            terceros_involucrados: s.terceros_involucrados ?? "",
          });
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
      />

      {dialogOpen && (
        <AddSiniestroDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          camiones={camiones}
          choferes={choferes}
          editing={editingSiniestro}
          onSaved={(data) => {
            if (editingSiniestro) {
              handleUpdate(editingSiniestro.id, data);
            } else {
              handleAdd(data);
            }
          }}
        />
      )}
    </div>
  );
}
