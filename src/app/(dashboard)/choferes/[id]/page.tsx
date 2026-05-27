"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getChoferDetailAction } from "./actions";
import type { ChoferDetail } from "./types";
import ChoferHeader from "./ChoferHeader";
import ChoferInfoTab from "./ChoferInfoTab";
import ChoferDocumentosTab from "./ChoferDocumentosTab";
import ChoferViajesTab from "./ChoferViajesTab";
import ChoferCuentaTab from "./ChoferCuentaTab";
import ChoferProductividadTab from "./ChoferProductividadTab";
import ChoferApercibimientosTab from "./ChoferApercibimientosTab";
import ChoferLicenciasTab from "./ChoferLicenciasTab";
import ChoferPrestamosTab from "./ChoferPrestamosTab";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

type TabId =
  | "info"
  | "documentos"
  | "viajes"
  | "cuenta"
  | "productividad"
  | "apercibimientos"
  | "licencias"
  | "prestamos";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
  { id: "productividad", label: "Productividad" },
  { id: "apercibimientos", label: "Apercibimientos" },
  { id: "licencias", label: "Licencias Médicas" },
  { id: "prestamos", label: "Préstamos" },
];

export default function ChoferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chofer_id = params.id as string;

  const [chofer, setChofer] = useState<ChoferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("info");

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getChoferDetailAction(chofer_id);
    setChofer(data);
    setLoading(false);
  }, [chofer_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Chofer no encontrado.</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} className="mr-1.5" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.back()}
        className="border-border text-muted-foreground hover:bg-muted/40"
      >
        <ArrowLeft size={14} className="mr-1.5" />
        Volver
      </Button>

      <ChoferHeader chofer={chofer} onRefresh={loadData} />

      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="flex items-center px-6 border-b border-border bg-muted/40 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-[#0088D1]"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 bg-card min-h-[50vh]">
          {activeTab === "info" && (
            <ChoferInfoTab key={chofer.updated_at} chofer={chofer} onSaved={loadData} />
          )}
          {activeTab === "documentos" && (
            <ChoferDocumentosTab chofer={chofer} onRefresh={loadData} />
          )}
          {activeTab === "viajes" && <ChoferViajesTab viajes={chofer.viajes_recientes} />}
          {activeTab === "cuenta" && <ChoferCuentaTab movimientos={chofer.movimientos_mes} />}
          {activeTab === "productividad" && (
            <ChoferProductividadTab
              kpis={chofer.productividad_kpis}
              historial={chofer.camiones_historial}
              adelantos={chofer.adelantos_mes}
            />
          )}
          {activeTab === "apercibimientos" && (
            <ChoferApercibimientosTab
              chofer_id={chofer.id}
              apercibimientos={chofer.apercibimientos}
              categorias={chofer.categorias_apercibimiento}
              is_admin={chofer.is_admin}
              onRefresh={loadData}
            />
          )}
          {activeTab === "licencias" && (
            <ChoferLicenciasTab
              chofer_id={chofer.id}
              licencias={chofer.licencias_medicas}
              is_admin={chofer.is_admin}
              onRefresh={loadData}
            />
          )}
          {activeTab === "prestamos" && (
            <ChoferPrestamosTab
              chofer_id={chofer.id}
              prestamos={chofer.prestamos}
              is_admin={chofer.is_admin}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
