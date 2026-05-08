import type { LucideIcon } from "lucide-react";

interface AlertItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  meta?: string;
  tone?: "warning" | "error" | "info";
}

const toneMap = {
  warning: { bg: "bg-[#FFFBEB]", text: "text-[#F59E0B]" },
  error: { bg: "bg-[#FEF2F2]", text: "text-[#EF4444]" },
  info: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]" },
};

export default function AlertItem({ icon: Icon, title, description, meta, tone = "warning" }: AlertItemProps) {
  const c = toneMap[tone];
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors">
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${c.bg} shrink-0`}>
        <Icon size={16} className={c.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#0F172A] text-sm font-medium truncate">{title}</p>
        <p className="text-[#475569] text-xs mt-0.5">{description}</p>
      </div>
      {meta && <span className="text-[#94A3B8] text-xs shrink-0">{meta}</span>}
    </div>
  );
}
