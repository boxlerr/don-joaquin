type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const toneMap: Record<StatusTone, { container: string; dot: string }> = {
  success: {
    container: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    dot: "bg-[#22C55E]",
  },
  warning: {
    container: "bg-[#FFFBEB] text-[#92400E] border-[#FEF3C7]",
    dot: "bg-[#F59E0B]",
  },
  error: {
    container: "bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]",
    dot: "bg-[#EF4444]",
  },
  info: {
    container: "bg-[#F0F9FF] text-[#075985] border-[#B3E5FC]",
    dot: "bg-[#0088D1]",
  },
  neutral: {
    container: "bg-muted/40 text-muted-foreground border-border",
    dot: "bg-[#94A3B8]",
  },
};

export default function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const styles = toneMap[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${styles.container}`}
    >
      <span className={`size-1.5 rounded-full ${styles.dot} animate-pulse-slow`} />
      {label}
    </span>
  );
}
