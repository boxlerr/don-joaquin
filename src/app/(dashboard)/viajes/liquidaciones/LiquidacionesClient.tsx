"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import DmYpfListClient from "./DmYpfListClient";
import LiqLomaListClient from "./LiqLomaListClient";
import type { DmYpfRow } from "./dm-actions";
import type { LiqLomaRow } from "./liq-actions";

type Seccion = "dm" | "liq";

interface Props {
  dms: DmYpfRow[];
  liqs: LiqLomaRow[];
  canDelete: boolean;
  initial?: Seccion;
}

/**
 * DM de YPF + Liquidaciones de Loma, juntos en Viajes.
 *
 * Son los documentos que cierran la hoja de ruta: certifican tonelaje e importe
 * de cada viaje. Se importan desde Viajes → Importar, y acá quedan listados con
 * su archivo original para descargar y el conteo de viajes vinculados.
 */
export default function LiquidacionesClient({ dms, liqs, canDelete, initial = "dm" }: Props) {
  const [seccion, setSeccion] = useState<Seccion>(initial);

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">DM y liquidaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Los documentos que cierran la hoja de ruta: el DM de YPF y las liquidaciones de fletes de
          Loma Negra certifican el tonelaje y el importe de cada viaje. Se importan desde{" "}
          <span className="font-medium text-foreground">Viajes → Importar</span>.
        </p>
      </div>

      {/* Tabs principales */}
      <div className="flex items-center gap-1 border-b border-border -mx-6 sm:-mx-8 px-6 sm:px-8">
        <TabButton
          icon={<FileText size={14} />}
          label="DM de YPF"
          badge={dms.length}
          active={seccion === "dm"}
          onClick={() => setSeccion("dm")}
        />
        <TabButton
          icon={<FileSpreadsheet size={14} />}
          label="Liquidaciones de Loma"
          badge={liqs.length}
          active={seccion === "liq"}
          onClick={() => setSeccion("liq")}
        />
      </div>

      {seccion === "dm" && <DmYpfListClient dms={dms} embedded />}
      {seccion === "liq" && <LiqLomaListClient liqs={liqs} canDelete={canDelete} embedded />}
    </div>
  );
}

function TabButton({
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
        active
          ? "text-primary border-primary"
          : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
      }`}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span
          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
            active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
