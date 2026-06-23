"use client";

import { useState } from "react";
import { ClipboardCheck, FileSpreadsheet } from "lucide-react";
import ComplianceChecklistPage from "../components/ComplianceChecklistPage";
import LiqLomaListClient from "./liq/LiqLomaListClient";
import type { ComplianceEstadoRow, ComplianceRequisito } from "../types";
import type { LiqLomaRow } from "./liq/actions";

interface Props {
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  canWrite: boolean;
  canDelete: boolean;
  liqs: LiqLomaRow[];
}

type Seccion = "checklist" | "liq";

/**
 * Wrapper de Compliance Loma Negra con tabs principales. Reúne el Checklist
 * documental (papeleta de vencimientos) y las Liquidaciones de fletes (Excels
 * que Loma paga, importados al sistema con su archivo original).
 */
export default function ComplianceLomaPage({
  rows,
  requisitos,
  canWrite,
  canDelete,
  liqs,
}: Props) {
  const [seccion, setSeccion] = useState<Seccion>("checklist");

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center gap-1 border-b border-border -mx-6 sm:-mx-8 px-6 sm:px-8">
        <TabButton
          icon={<ClipboardCheck size={14} />}
          label="Checklist"
          active={seccion === "checklist"}
          onClick={() => setSeccion("checklist")}
        />
        <TabButton
          icon={<FileSpreadsheet size={14} />}
          label="Liquidaciones"
          badge={liqs.length}
          active={seccion === "liq"}
          onClick={() => setSeccion("liq")}
        />
      </div>

      {seccion === "checklist" && (
        <ComplianceChecklistPage
          cliente="LOMA_NEGRA"
          rows={rows}
          requisitos={requisitos}
          canWrite={canWrite}
          embedded
        />
      )}

      {seccion === "liq" && (
        <LiqLomaListClient liqs={liqs} canDelete={canDelete} embedded />
      )}
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
