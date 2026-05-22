"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { 
  HelpCircle, 
  Plus, 
  Wrench,
  Calendar,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import MantenimientoTable, { MantenimientoOrden, Unidad, Chofer } from "./MantenimientoTable";
import AddOrdenDialog from "./AddOrdenDialog";

interface MantenimientoClientProps {
  dbCamiones: Unidad[];
  dbChoferes: Chofer[];
}

const MOCK_DATA = [
  {
    id: "MT-0008",
    unidad: { patente: "AB 123 CD", marca: "Scania", modelo: "v200" },
    tipo: "Preventivo",
    descripcion: "Cambio de aceite y filtros",
    fechaProgramada: "15/05/2024",
    estado: "Programada",
    prioridad: "Media",
    encargado: "Propio" as const
  },
  {
    id: "MT-0007",
    unidad: { patente: "XY 456 EF", marca: "Volvo", modelo: "FH" },
    tipo: "Correctivo",
    descripcion: "Freno delantero izquierdo",
    fechaProgramada: "10/05/2024",
    estado: "En proceso",
    prioridad: "Alta",
    encargado: "Tercerizado" as const,
    empresa: "Mecánica Warnes"
  },
  {
    id: "MT-0006",
    unidad: { patente: "GH 789 IJ", marca: "Mercedes", modelo: "Actros" },
    tipo: "Preventivo",
    descripcion: "Revisión general 20.000 km",
    fechaProgramada: "05/05/2024",
    estado: "Completada",
    prioridad: "Media",
    encargado: "Propio" as const
  },
  {
    id: "MT-0005",
    unidad: { patente: "KL 012 MN", marca: "Iveco", modelo: "Stralis" },
    tipo: "Preventivo",
    descripcion: "Cambio de aceite y filtros",
    fechaProgramada: "28/04/2024",
    estado: "Completada",
    prioridad: "Baja",
    encargado: "Tercerizado" as const,
    empresa: "Servicio Oficial Iveco"
  },
  {
    id: "MT-0004",
    unidad: { patente: "OP 345 QR", marca: "Scania", modelo: "v200" },
    tipo: "Correctivo",
    descripcion: "Sistema eléctrico",
    fechaProgramada: "20/04/2024",
    estado: "Vencida",
    prioridad: "Alta",
    encargado: "Propio" as const
  }
];

export default function MantenimientoClient({ dbCamiones, dbChoferes }: MantenimientoClientProps) {
  const [data, setData] = useState<MantenimientoOrden[]>(() => {
    const dbPatentes = new Set((dbCamiones || []).map(c => c.patente.trim().toUpperCase()));
    const filtered = MOCK_DATA.filter((item) => dbPatentes.has(item.unidad.patente.trim().toUpperCase()));
    return filtered.map((item) => {
      if (item.tipo === "Correctivo" && dbChoferes && dbChoferes.length > 0) {
        return {
          ...item,
          chofer: dbChoferes[0]
        };
      }
      return item;
    });
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnidad, setFilterUnidad] = useState("Todas las unidades");

  const handleUpdate = (id: string, updatedFields: Partial<MantenimientoOrden>) => {
    setData((prev) => 
      prev.map((item) => (item.id === id ? { ...item, ...updatedFields } : item))
    );
  };

  const handleDelete = (id: string) => {
    setData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddOrden = (newOrden: MantenimientoOrden) => {
    setData((prev) => [newOrden, ...prev]);
  };

  const generateNextId = () => {
    if (data.length === 0) return "MT-0001";
    const ids = data.map((o) => {
      const num = parseInt(o.id.replace("MT-", ""));
      return isNaN(num) ? 0 : num;
    });
    const maxId = Math.max(...ids);
    return `MT-${String(maxId + 1).padStart(4, "0")}`;
  };

  // Filter data based on search and select
  const filteredData = data.filter((item) => {
    const matchesSearch = 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.unidad.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUnidad = filterUnidad === "Todas las unidades" || item.unidad.patente === filterUnidad;
    return matchesSearch && matchesUnidad;
  });

  // Calculate statistics from the current data state
  const totalOrdenes = data.length;
  const programadas = data.filter(o => o.estado === "Programada").length;
  const enProceso = data.filter(o => o.estado === "En proceso").length;
  const completadas = data.filter(o => o.estado === "Completada").length;
  const vencidas = data.filter(o => o.estado === "Vencida").length;

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Mantenimiento"
        description="Gestioná el mantenimiento preventivo y correctivo de la flota"
        action={
          <div className="flex items-center gap-3">
            <button className="text-[#64748B] hover:text-[#0F172A] transition-colors p-2 rounded-full hover:bg-slate-100">
              <HelpCircle size={20} />
            </button>
            
            <AddOrdenDialog
              camiones={dbCamiones}
              choferes={dbChoferes}
              nextId={generateNextId()}
              onAdd={handleAddOrden}
            >
              <Button
                variant="brand"
                className="bg-[#0088D1] hover:bg-[#0277BD] text-white gap-2 px-5 font-semibold shadow-sm ml-2"
              >
                <Plus size={16} strokeWidth={2.5} /> Nueva orden
              </Button>
            </AddOrdenDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <StatCard 
          label="ÓRDENES TOTALES" 
          value={totalOrdenes.toString()} 
          sub="Este mes" 
          color="brand" 
          icon={Wrench} 
          variant="dashboard" 
        />
        <StatCard 
          label="PROGRAMADAS" 
          value={programadas.toString()} 
          sub="Pendientes" 
          color="success" 
          icon={Calendar} 
          variant="dashboard" 
        />
        <StatCard 
          label="EN PROCESO" 
          value={enProceso.toString()} 
          sub="En taller" 
          color="warning" 
          icon={Wrench} 
          variant="dashboard" 
        />
        <StatCard 
          label="COMPLETADAS" 
          value={completadas.toString()} 
          sub="Este mes" 
          color="success" 
          icon={CheckCircle} 
          variant="dashboard" 
        />
        <StatCard 
          label="VENCIDAS" 
          value={vencidas.toString()} 
          sub="Requieren atención" 
          color="error" 
          icon={AlertCircle} 
          variant="dashboard" 
        />
      </div>

      <MantenimientoTable 
        data={filteredData}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterUnidad={filterUnidad}
        setFilterUnidad={setFilterUnidad}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        camiones={dbCamiones}
        choferes={dbChoferes}
      />
    </div>
  );
}
