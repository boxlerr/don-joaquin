"use client";

import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { AUDIT_DRAWER_EVENT } from "@/components/layout/DashboardShell";

export function OpenAuditButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.dispatchEvent(new Event(AUDIT_DRAWER_EVENT))}
    >
      <History size={14} />
      Auditoría
    </Button>
  );
}
