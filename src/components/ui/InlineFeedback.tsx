"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Variant = "success" | "error";

const STYLES: Record<Variant, { container: string; icon: string; iconCmp: typeof CheckCircle2 }> = {
  success: {
    container: "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]",
    icon: "text-[#10B981]",
    iconCmp: CheckCircle2,
  },
  error: {
    container: "bg-red-50 border-red-200 text-red-700",
    icon: "text-red-500",
    iconCmp: AlertCircle,
  },
};

export default function InlineFeedback({
  variant,
  message,
  autoHideMs = 2500,
  onDismiss,
}: {
  variant: Variant;
  message: string;
  autoHideMs?: number;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!autoHideMs || !onDismiss) return;
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [autoHideMs, onDismiss, message]);

  const s = STYLES[variant];
  const Icon = s.iconCmp;

  return (
    <div
      role="status"
      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${s.container}`}
    >
      <Icon size={16} className={s.icon} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
