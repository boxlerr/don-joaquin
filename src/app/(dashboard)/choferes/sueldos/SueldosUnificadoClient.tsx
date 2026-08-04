"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Truck, Wallet, TrendingUp, HelpCircle, Upload } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import { descargarExport } from "@/lib/download-export";
import SueldosClient from "./SueldosClient";
import SueldosAdminClient from "../../sueldos-admin/SueldosAdminClient";
import ImportSueldosDialog from "../../sueldos-admin/ImportSueldosDialog";
import HelpTutorialButton from "../../sueldos-admin/help-tutorial-button";
import SueldosTutorial from "./SueldosTutorial";
import type { SueldoChoferRow } from "./actions";
import type { SueldosAdminResumen } from "../../sueldos-admin/actions";
import type { InflacionData } from "@/lib/inflacion";

type TabId = "choferes" | "admin" | "aumentos";

export default function SueldosUnificadoClient({
  choferes, admin, inflacion, month, canChoferes, canAdmin, canAdminWrite,
}: {
  choferes: SueldoChoferRow[] | null;
  admin: SueldosAdminResumen | null;
  inflacion: InflacionData | null;
  month: string;
  canChoferes: boolean;
  canAdmin: boolean;
  canAdminWrite: boolean;
}) {
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    ...(canChoferes ? [{ id: "choferes" as const, label: "Choferes", icon: Truck }] : []),
    ...(canAdmin ? [
      { id: "admin" as const, label: "Admin y taller", icon: Wallet },
      { id: "aumentos" as const, label: "Aumentos", icon: TrendingUp },
    ] : []),
  ];
  const [tab, setTab] = useState<TabId>(tabs[0]?.id ?? "choferes");
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const router = useRouter();

  const handleExport = () =>
    descargarExport(
      `/choferes/sueldos/export?month=${month ?? ""}`,
      `sueldos_${month || "mes-actual"}.xlsx`,
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-3.5 h-8 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5 ${tab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {canAdminWrite && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload size={14} /> Importar Excel
            </Button>
          )}
          <ExportButton onClick={handleExport} label="Exportar" />
          {/* Una sola ayuda por pestaña: la guía detallada para la planilla y los
              aumentos, y el recorrido de la sección para la de choferes. */}
          {tab === "choferes" ? (
            <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="gap-1.5">
              <HelpCircle size={14} /> ¿Cómo funciona?
            </Button>
          ) : (
            <HelpTutorialButton triggerClassName="h-7 px-2.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background text-primary hover:bg-muted inline-flex items-center gap-1 text-[0.8rem] font-medium" />
          )}
        </div>
      </div>

      {tab === "choferes" && choferes && <SueldosClient resumen={choferes} month={month} />}
      {tab === "admin" && admin && <SueldosAdminClient resumen={admin} month={month} canWrite={canAdminWrite} mostrar="planilla" />}
      {tab === "aumentos" && admin && <SueldosAdminClient resumen={admin} month={month} canWrite={canAdminWrite} mostrar="aumentos" inflacion={inflacion} />}

      {helpOpen && <SueldosTutorial canChoferes={canChoferes} canAdmin={canAdmin} onClose={() => setHelpOpen(false)} />}
      {canAdminWrite && (
        <ImportSueldosDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => router.refresh()} />
      )}
    </div>
  );
}
