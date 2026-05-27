import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Fuel, Wrench, ShieldCheck, AlertCircle, FileText, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddCamionDialog from "./components/AddCamionDialog";
import AddServiceDialog from "./components/AddServiceDialog";
import AddGasoilDialog from "./components/AddGasoilDialog";
import CamionesTableClient from "./components/CamionesTableClient";
import { ExportCamionesButton, ImportCamionesButton } from "./components/CamionesIO";
import HelpTutorialButton from "./help-tutorial-button";
import AddGastoDialog from "../gastos/components/AddGastoDialog";
import { getGastoFormData } from "../gastos/actions";
import { getTiposServicioAction } from "./actions";
import { redirect } from "next/navigation";

export default async function CamionesPage({
  searchParams,
}: {
  searchParams: Promise<{ documentoId?: string }>;
}) {
  const user = await requireArea("flota", "read");
  const canWrite = hasArea(user, "flota", "write");
  const canRegistrarGasto = hasArea(user, "finanzas", "write");
  const supabase = createAdminClient();

  const { documentoId } = await searchParams;
  if (documentoId) {
    const { data: docData } = await supabase
      .from("camion_documentos")
      .select("camion_id")
      .eq("id", documentoId)
      .single();
    if (docData?.camion_id) {
      redirect(`/camiones?camionId=${docData.camion_id}&tab=docs`);
    }
  }

  const [{ data: camiones, count: total }, operativos, mantenimiento, docVencer, { data: fotosPrincipales }, gastoFormData, tiposServicio] =
    await Promise.all([
      supabase
        .from("camiones")
        .select(
          "id, patente, marca, modelo, ano, capacidad_tn, tipo_camion, estado, tercerizacion_estado, es_tolva, km_actual",
          { count: "exact" }
        )
        .order("patente")
        .limit(50),
      supabase
        .from("camiones")
        .select("*", { count: "exact", head: true })
        .eq("estado", "activo"),
      supabase
        .from("camiones")
        .select("*", { count: "exact", head: true })
        .eq("estado", "en_mantenimiento"),
      supabase.from("camion_documentos").select("*", { count: "exact", head: true }),
      supabase
        .from("camion_fotos")
        .select("camion_id, archivo:documentos_archivos!archivo_id(bucket, path)")
        .eq("es_principal", true),
      getGastoFormData(),
      getTiposServicioAction(),
    ]);

  const fotosMap = new Map<string, string>();
  for (const f of fotosPrincipales ?? []) {
    const archivo = Array.isArray(f.archivo) ? f.archivo[0] : f.archivo;
    if (!archivo) continue;
    const { data: pub } = supabase.storage.from(archivo.bucket).getPublicUrl(archivo.path);
    fotosMap.set(f.camion_id, pub.publicUrl);
  }

  const camionesConFoto = (camiones ?? []).map((c) => ({
    ...c,
    foto_url: fotosMap.get(c.id) ?? null,
  }));

  return (
    <div className="p-8">
      <PageHeader
        title="Camiones"
        description={`Flota de ${total ?? 0} unidades — documentación, mantenimiento y gasoil`}
        action={
          <div className="flex items-center gap-2.5">
            <HelpTutorialButton />
            <div className="h-6 w-px bg-[#E2E8F0] mx-1" />
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
              {canWrite && <ImportCamionesButton />}
              <ExportCamionesButton />
            </div>
            <div className="h-6 w-px bg-[#E2E8F0] mx-1" />
            {canWrite && (
              <AddGasoilDialog camiones={camiones || []}>
                <Button variant="outline" size="default" className="bg-card border-border text-muted-foreground hover:text-primary hover:border-[#0088D1] hover:bg-[#E1F5FE]/30 transition-all">
                  <Fuel size={14} className="text-primary" />
                  Cargar gasoil
                </Button>
              </AddGasoilDialog>
            )}
            {canWrite && (
              <AddServiceDialog camiones={camiones || []} tiposServicio={tiposServicio}>
                <Button variant="outline" size="default" className="bg-card border-border text-muted-foreground hover:text-primary hover:border-[#0088D1] hover:bg-[#E1F5FE]/30 transition-all">
                  <Wrench size={14} className="text-primary" />
                  Registrar service
                </Button>
              </AddServiceDialog>
            )}
            {canRegistrarGasto && (
              <AddGastoDialog
                tiposGasto={gastoFormData.tiposGasto}
                viajes={gastoFormData.viajes}
                camiones={gastoFormData.camiones}
                choferes={gastoFormData.choferes}
              >
                <Button variant="outline" size="default" className="bg-card border-border text-muted-foreground hover:text-primary hover:border-[#0088D1] hover:bg-[#E1F5FE]/30 transition-all">
                  <Receipt size={14} className="text-primary" />
                  Registrar gasto
                </Button>
              </AddGastoDialog>
            )}
            {canWrite && (
              <AddCamionDialog>
                <Button variant="brand" size="default" className="shadow-md shadow-[#0088D1]/20">
                  <Plus size={16} strokeWidth={3} />
                  Agregar camión
                </Button>
              </AddCamionDialog>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Total flota" 
          value={String(total ?? 0)} 
          sub="Unidades activas" 
          color="brand" 
          icon={Truck}
        />
        <StatCard 
          label="Operativos" 
          value={String(operativos.count ?? 0)} 
          sub="En servicio"
          color="success" 
          icon={ShieldCheck}
        />
        <StatCard 
          label="En mantenimiento" 
          value={String(mantenimiento.count ?? 0)} 
          sub="Taller / Reparación"
          color="warning" 
          icon={AlertCircle}
        />
        <StatCard
          label="Documentación"
          value={String(docVencer.count ?? 0)}
          sub="Vencimientos próximos"
          color="error"
          icon={FileText}
        />
      </div>

      <CamionesTableClient camiones={camionesConFoto} tiposServicio={tiposServicio} />
    </div>
  );
}
