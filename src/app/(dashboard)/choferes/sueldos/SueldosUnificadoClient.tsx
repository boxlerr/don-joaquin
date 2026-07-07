"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Truck, Wallet, TrendingUp, HelpCircle, X } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import { descargarExport } from "@/lib/download-export";
import SueldosClient from "./SueldosClient";
import SueldosAdminClient from "../../sueldos-admin/SueldosAdminClient";
import type { SueldoChoferRow } from "./actions";
import type { SueldosAdminResumen } from "../../sueldos-admin/actions";

type TabId = "choferes" | "admin" | "aumentos";

export default function SueldosUnificadoClient({
  choferes, admin, month, canChoferes, canAdmin, canAdminWrite,
}: {
  choferes: SueldoChoferRow[] | null;
  admin: SueldosAdminResumen | null;
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

  const handleExport = () =>
    descargarExport(
      `/choferes/sueldos/export?month=${month ?? ""}`,
      `sueldos_${month || "mes-actual"}.xlsx`,
    );

  return (
    <div className="space-y-6">
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
          <ExportButton onClick={handleExport} label="Exportar" />
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="gap-1.5">
            <HelpCircle size={14} /> ¿Cómo funciona?
          </Button>
        </div>
      </div>

      {tab === "choferes" && choferes && <SueldosClient resumen={choferes} month={month} />}
      {tab === "admin" && admin && <SueldosAdminClient resumen={admin} month={month} canWrite={canAdminWrite} mostrar="planilla" />}
      {tab === "aumentos" && admin && <SueldosAdminClient resumen={admin} month={month} canWrite={canAdminWrite} mostrar="aumentos" />}

      {helpOpen && <AyudaDialog onClose={() => setHelpOpen(false)} canChoferes={canChoferes} canAdmin={canAdmin} />}
    </div>
  );
}

function AyudaDialog({ onClose, canChoferes, canAdmin }: { onClose: () => void; canChoferes: boolean; canAdmin: boolean }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HelpCircle size={18} className="text-primary" /> Cómo funciona Sueldos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-foreground/90">
          <p>Todo lo de sueldos en un solo lugar, con pestañas. El mes se cambia con el selector de arriba a la derecha.</p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
            {canChoferes && (
              <p><strong className="text-foreground">Choferes</strong> — la base para liquidar: el sistema arma los totales por chofer desde la hoja de ruta (viajes, km, toneladas) y discrimina <strong>al sur</strong> y <strong>zona petrolera/pozo</strong>. Falta cargar las tarifas por concepto (las define Bárbara) para el monto en $.</p>
            )}
            {canAdmin && (
              <>
                <p><strong className="text-foreground">Admin y taller</strong> — la planilla del personal de administración y taller: sueldo base + comisión logística, combustible, plus YPF y sábados (las columnas del Excel). El total del mes se compara contra la facturación para ver qué % se lleva.</p>
                <p><strong className="text-foreground">Aumentos</strong> — la matriz de sueldo base vigente mes a mes (como la hoja de aumentos del Excel). El <strong>año</strong> va arriba (2025, 2026…) y el mes abajo. Tocá cualquier <strong>celda</strong> (o un nombre) para cargar o editar un aumento, y con <strong>«Agregar mes»</strong> sumás una columna nueva con el paso del tiempo.</p>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Sección confidencial: la ven solo los administradores.</p>
        </div>
        <DialogFooter>
          <Button variant="brand" onClick={onClose}><X size={14} /> Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
