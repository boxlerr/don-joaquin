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
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";

type TabId = "info" | "documentos" | "viajes" | "cuenta";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
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
        <Loader2 size={36} className="animate-spin text-[#0088D1]" />
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#64748B] mb-4">Chofer no encontrado.</p>
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
        className="border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]"
      >
        <ArrowLeft size={14} className="mr-1.5" />
        Volver
      </Button>

      <ChoferHeader chofer={chofer} onRefresh={loadData} />

      <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="flex items-center px-6 border-b border-[#E2E8F0] bg-[#F8FAFC] overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-[#0088D1] border-[#0088D1]"
                  : "text-[#64748B] border-transparent hover:text-[#0F172A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 bg-[#FDFDFD] min-h-[50vh]">
          {activeTab === "info" && (
            <ChoferInfoTab key={chofer.updated_at} chofer={chofer} onSaved={loadData} />
          )}
          {activeTab === "documentos" && (
            <ChoferDocumentosTab chofer={chofer} onRefresh={loadData} />
          )}
          {activeTab === "viajes" && <ChoferViajesTab viajes={chofer.viajes_recientes} />}
          {activeTab === "cuenta" && <ChoferCuentaTab movimientos={chofer.movimientos_mes} />}
        </div>
      </div>
    </div>
  );
}
