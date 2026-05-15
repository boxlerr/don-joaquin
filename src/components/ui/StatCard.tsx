import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "brand" | "success" | "warning" | "error";
  icon?: LucideIcon;
}

const colorMap = {
  brand: {
    bg: "bg-[#F0F9FF]",
    text: "text-[#0088D1]",
    border: "border-[#B3E5FC]/50",
    iconBg: "bg-[#0088D1]/10",
  },
  success: {
    bg: "bg-[#F0FDF4]",
    text: "text-[#10B981]",
    border: "border-[#BBF7D0]/50",
    iconBg: "bg-[#10B981]/10",
  },
  warning: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#F59E0B]",
    border: "border-[#FEF3C7]/50",
    iconBg: "bg-[#F59E0B]/10",
  },
  error: {
    bg: "bg-[#FEF2F2]",
    text: "text-[#EF4444]",
    border: "border-[#FECACA]/50",
    iconBg: "bg-[#EF4444]/10",
  },
};

export default function StatCard({ label, value, sub, color = "brand", icon: Icon }: StatCardProps) {
  const styles = colorMap[color];

  return (
    <div className={`relative overflow-hidden bg-white rounded-xl border ${styles.border} p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[#64748B] text-xs font-bold uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-black tracking-tight ${styles.text}`}>{value}</p>
            {sub && <p className="text-[#94A3B8] text-[11px] font-medium">{sub}</p>}
          </div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${styles.iconBg} ${styles.text} transition-colors group-hover:bg-opacity-20`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
        )}
      </div>
      {/* Decorative background element */}
      <div className={`absolute -right-4 -bottom-4 size-24 rounded-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity ${styles.bg}`} />
    </div>
  );
}
