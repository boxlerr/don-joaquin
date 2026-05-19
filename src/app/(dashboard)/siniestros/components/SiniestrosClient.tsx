"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, DollarSign, Calendar, Truck } from "lucide-react";
import AddSiniestroDialog, { SiniestroEditing } from "./AddSiniestroDialog";
import SiniestrosTable, { SiniestroConRelaciones } from "./SiniestrosTable";

interface SiniestrosClientProps {
  camiones: { id: string; patente: string; marca: string; modelo: string }[];
  choferes: { id: string; nombre: string; apellido: string | null }[];
}

const LOCAL_STORAGE_KEY = "don_joaquin_siniestros";

export default function SiniestrosClient({ camiones, choferes }: SiniestrosClientProps) {
  const [siniestros, setSiniestros] = useState<SiniestroConRelaciones[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSiniestro, setEditingSiniestro] = useState<SiniestroEditing | null>(null);

  // Cargar de localStorage en el montaje
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setSiniestros(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing localStorage siniestros:", e);
      }
    } else {
      // Si está vacío, cargar datos de prueba vinculados a camiones/choferes reales
      const mockSiniestros: SiniestroConRelaciones[] = [];
      
      if (camiones.length > 0) {
        mockSiniestros.push({
          id: "mock-1",
          camion_id: camiones[0].id,
          chofer_id: choferes[0]?.id || null,
          fecha: "2026-05-10",
          descripcion: "Roce lateral en maniobra de estacionamiento marcha atrás. Afectó paragolpes trasero derecho.",
          monto_danos: 250000,
          compania_seguro: "La Caja",
          numero_siniestro_seguro: "LC-981273",
          terceros_involucrados: "Ninguno (colisión contra poste de luz)",
          created_at: new Date().toISOString(),
          created_by: null,
          camion: {
            patente: camiones[0].patente,
            marca: camiones[0].marca,
            modelo: camiones[0].modelo,
          },
          chofer: choferes[0] ? { nombre: choferes[0].nombre, apellido: choferes[0].apellido } : null,
        });

        if (camiones.length > 1) {
          mockSiniestros.push({
            id: "mock-2",
            camion_id: camiones[1].id,
            chofer_id: choferes[1]?.id || choferes[0]?.id || null,
            fecha: "2026-04-18",
            descripcion: "Piedra en ruta impactó sobre el parabrisas delantero provocando una rajadura importante. Reemplazo completo del cristal.",
            monto_danos: 680000,
            compania_seguro: "San Cristóbal",
            numero_siniestro_seguro: "SC-441209",
            terceros_involucrados: "No aplica",
            created_at: new Date().toISOString(),
            created_by: null,
            camion: {
              patente: camiones[1].patente,
              marca: camiones[1].marca,
              modelo: camiones[1].modelo,
            },
            chofer: choferes[1] ? { nombre: choferes[1].nombre, apellido: choferes[1].apellido } : (choferes[0] ? { nombre: choferes[0].nombre, apellido: choferes[0].apellido } : null),
          });
        }
      }

      setSiniestros(mockSiniestros);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockSiniestros));
    }
  }, [camiones, choferes]);

  // Guardar en localStorage cada vez que cambia el estado
  const saveSiniestros = (list: SiniestroConRelaciones[]) => {
    setSiniestros(list);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  };

  const handleAddSiniestro = (data: Omit<SiniestroConRelaciones, "id" | "created_at" | "created_by" | "camion" | "chofer">) => {
    const camion = camiones.find((c) => c.id === data.camion_id) || null;
    const chofer = choferes.find((ch) => ch.id === data.chofer_id) || null;

    const newSiniestro: SiniestroConRelaciones = {
      ...data,
      id: `siniestro-${Date.now()}`,
      created_at: new Date().toISOString(),
      created_by: null,
      camion: camion ? { patente: camion.patente, marca: camion.marca, modelo: camion.modelo } : null,
      chofer: chofer ? { nombre: chofer.nombre, apellido: chofer.apellido } : null,
    };

    saveSiniestros([newSiniestro, ...siniestros]);
  };

  const handleUpdateSiniestro = (
    id: string,
    data: Omit<SiniestroConRelaciones, "id" | "created_at" | "created_by" | "camion" | "chofer">
  ) => {
    const camion = camiones.find((c) => c.id === data.camion_id) || null;
    const chofer = choferes.find((ch) => ch.id === data.chofer_id) || null;

    const updatedList = siniestros.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          ...data,
          camion: camion ? { patente: camion.patente, marca: camion.marca, modelo: camion.modelo } : null,
          chofer: chofer ? { nombre: chofer.nombre, apellido: chofer.apellido } : null,
        };
      }
      return s;
    });

    saveSiniestros(updatedList);
  };

  const handleDeleteSiniestro = (id: string) => {
    const updatedList = siniestros.filter((s) => s.id !== id);
    saveSiniestros(updatedList);
  };

  // Estadísticas
  const totalSiniestros = siniestros.length;
  const totalMonto = siniestros.reduce((acc, curr) => acc + (curr.monto_danos || 0), 0);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const startOfMonthStr = `${year}-${month}-01`;
  const esteMes = siniestros.filter((s) => s.fecha >= startOfMonthStr).length;

  const camionesAfectados = new Set(siniestros.map((s) => s.camion_id)).size;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Siniestros"
        description="Historial y registro de siniestros de la flota (Modo Demo sin Base de Datos)"
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

      {/* Grid de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Siniestros"
          value={totalSiniestros.toString()}
          sub="Registrados localmente"
          color="brand"
          icon={AlertTriangle}
          variant="dashboard"
        />
        <StatCard
          label="Costo Daños Estimado"
          value={`$ ${totalMonto.toLocaleString("es-AR")}`}
          sub="Monto acumulado registrado"
          color="error"
          icon={DollarSign}
          variant="dashboard"
        />
        <StatCard
          label="Siniestros Este Mes"
          value={esteMes.toString()}
          sub="Ocurridos en el mes en curso"
          color="warning"
          icon={Calendar}
          variant="dashboard"
        />
        <StatCard
          label="Camiones Afectados"
          value={camionesAfectados.toString()}
          sub="Unidades con al menos 1 siniestro"
          color="success"
          icon={Truck}
          variant="dashboard"
        />
      </div>

      {/* Tabla con filtros y listado */}
      <SiniestrosTable
        siniestros={siniestros}
        camiones={camiones}
        choferes={choferes}
        onEdit={(s) => {
          setEditingSiniestro(s);
          setDialogOpen(true);
        }}
        onDelete={handleDeleteSiniestro}
      />

      {dialogOpen && (
        <AddSiniestroDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          camiones={camiones}
          choferes={choferes}
          editing={editingSiniestro}
          onSavedLocal={(data) => {
            if (editingSiniestro) {
              handleUpdateSiniestro(editingSiniestro.id, data);
            } else {
              handleAddSiniestro(data);
            }
          }}
        />
      )}
    </div>
  );
}
