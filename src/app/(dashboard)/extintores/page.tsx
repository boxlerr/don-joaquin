import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Flame, ShieldAlert, ShieldCheck, AlertTriangle, ShieldX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import ExtintoresTable from "./components/ExtintoresTable";
import { ExportExtintoresButton, ImportExtintoresButton } from "./components/ExtintoresIO";

export default async function ExtintoresPage() {
  // Verificar permisos (requiere lectura de flota)
  const user = await requireArea("flota", "read");
  const canWrite = hasArea(user, "flota", "write");

  const supabase = createAdminClient();

  // Cargar extintores y patentes de camiones
  const [extintoresRes, camionesRes] = await Promise.all([
    supabase
      .from("extintores")
      .select("*")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
    supabase
      .from("camiones")
      .select("id, patente"),
  ]);

  const extintores = extintoresRes.data || [];
  const camiones = camionesRes.data || [];

  // Calcular métricas para las tarjetas de estadísticas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limitePorVencer = new Date();
  limitePorVencer.setDate(limitePorVencer.getDate() + 30);
  limitePorVencer.setHours(23, 59, 59, 999);

  let countTotal = extintores.length;
  let countVencidos = 0;
  let countPorVencer = 0;
  let countVigentes = 0;
  let countSinFecha = 0;

  for (const item of extintores) {
    if (!item.fecha_vencimiento) {
      countSinFecha++;
      continue;
    }
    const venc = new Date(item.fecha_vencimiento);
    venc.setHours(0, 0, 0, 0);

    if (venc < hoy) {
      countVencidos++;
    } else if (venc <= limitePorVencer) {
      countPorVencer++;
    } else {
      countVigentes++;
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Extintores"
        description="Vencimientos, ubicaciones y estado de vigencia de matafuegos de la flota y establecimientos"
        action={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
              {canWrite && <ImportExtintoresButton />}
              <ExportExtintoresButton />
            </div>
          </div>
        }
      />

      {/* Grid de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Extintores"
          value={String(countTotal)}
          sub="Equipos inventariados"
          color="brand"
          icon={Flame}
        />
        <StatCard
          label="Vencidos"
          value={String(countVencidos)}
          sub="Requieren recarga urgente"
          color="error"
          icon={ShieldX}
        />
        <StatCard
          label="Próximos a Vencer"
          value={String(countPorVencer)}
          sub="Vencen en los próximos 30 días"
          color="warning"
          icon={AlertTriangle}
        />
        <StatCard
          label="Vigentes"
          value={String(countVigentes)}
          sub="Matafuegos operativos"
          color="success"
          icon={ShieldCheck}
        />
      </div>

      {/* Tabla Cliente */}
      <ExtintoresTable extintores={extintores} camiones={camiones} />
    </div>
  );
}
