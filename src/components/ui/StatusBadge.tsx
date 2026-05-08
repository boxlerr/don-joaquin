type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const toneMap: Record<StatusTone, string> = {
  success: "bg-[#ECFDF5] text-[#064E3B] border-[#10B981]/30",
  warning: "bg-[#FFFBEB] text-[#78350F] border-[#F59E0B]/30",
  error: "bg-[#FEF2F2] text-[#7F1D1D] border-[#EF4444]/30",
  info: "bg-[#EFF6FF] text-[#1E3A8A] border-[#3B82F6]/30",
  neutral: "bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]",
};

export default function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold uppercase tracking-wide ${toneMap[tone]}`}
    >
      {label}
    </span>
  );
}
