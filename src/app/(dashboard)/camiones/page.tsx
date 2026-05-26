import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Truck, Plus, Fuel, Wrench, ShieldCheck, AlertCircle, FileText, Search, ChevronRight, Receipt } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea, hasArea } from "@/lib/auth";
import AddCamionDialog from "./components/AddCamionDialog";
import AddServiceDialog from "./components/AddServiceDialog";
import AddGasoilDialog from "./components/AddGasoilDialog";
import CamionRow from "./components/CamionRow";
import { ExportCamionesButton, ImportCamionesButton } from "./components/CamionesIO";
import HelpTutorialButton from "./help-tutorial-button";
import AddGastoDialog from "../gastos/components/AddGastoDialog";
import { getGastoFormData } from "../gastos/actions";

export default async function CamionesPage() {
  const user = await requireArea("flota", "read");
  const canWrite = hasArea(user, "flota", "write");
  const canRegistrarGasto = hasArea(user, "finanzas", "write");
  const supabase = createAdminClient();

  const [{ data: camiones, count: total }, operativos, mantenimiento, docVencer, { data: fotosPrincipales }, gastoFormData] =
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
              <AddServiceDialog camiones={camiones || []}>
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

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-5 gap-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E1F5FE] rounded-lg text-primary">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="text-foreground text-lg font-bold">Listado de Unidades</h2>
              <p className="text-muted-foreground text-xs font-medium">Gestioná el estado y documentación de tu flota</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <select className="h-10 pl-4 pr-10 text-sm border border-border rounded-lg bg-card text-muted-foreground appearance-none focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] outline-none transition-all cursor-pointer min-w-[180px]">
                <option>Todas las capacidades</option>
                <option>TN ESC 35</option>
                <option>TN ESC 37.5</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/70">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              <Input 
                type="search" 
                placeholder="Buscar patente..." 
                className="w-64 h-10 pl-9 text-sm rounded-lg border-border focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] transition-all" 
              />
            </div>
          </div>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {[
                "Patente",
                "Marca/Modelo",
                "Año",
                "Capacidad",
                "Tipo",
                "Estado",
              ].map((col) => (
                <TableHead
                  key={col}
                  className={`text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 ${col === "Patente" ? "pl-6" : ""}`}
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {camionesConFoto.length === 0 ? (
              <EmptyTableRow message="Sin camiones registrados" />
            ) : (
              camionesConFoto.map((c) => (
                <CamionRow key={c.id} camion={c} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
