"use client";

import { useState } from "react";
import { ClipboardCheck, FileText } from "lucide-react";
import ComplianceChecklistPage from "../components/ComplianceChecklistPage";
import DmYpfListClient from "./dm/DmYpfListClient";
import type {
  ComplianceEstadoRow,
  ComplianceRequisito,
} from "../types";
import type { DmYpfRow } from "./dm/actions";

interface Props {
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  canWrite: boolean;
  dms: DmYpfRow[];
}

type Seccion = "checklist" | "dm";

/**
 * Wrapper de Compliance YPF con tabs principales. Reúne en una sola
 * pantalla el Checklist documental (papeleta de vencimientos) y los
 * Documentos DM (PDFs firmados por YPF importados al sistema).
 */
export default function ComplianceYpfPage({
  rows,
  requisitos,
  canWrite,
  dms,
}: Props) {
  const [seccion, setSeccion] = useState<Seccion>("checklist");

  return (
    <div className="space-y-4">
      {/* Tabs principales */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton
          icon={<ClipboardCheck size={14} />}
          label="Checklist"
          active={seccion === "checklist"}
          onClick={() => setSeccion("checklist")}
        />
        <TabButton
          icon={<FileText size={14} />}
          label="Documentos DM"
          badge={dms.length}
          active={seccion === "dm"}
          onClick={() => setSeccion("dm")}
        />
      </div>

      {seccion === "checklist" && (
        <ComplianceChecklistPage
          cliente="YPF"
          rows={rows}
          requisitos={requisitos}
          canWrite={canWrite}
        />
      )}

      {seccion === "dm" && (
        <DmYpfListClient dms={dms} embedded />
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
            active
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
