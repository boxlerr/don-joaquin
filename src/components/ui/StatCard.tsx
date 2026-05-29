import type React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "brand" | "success" | "warning" | "error";
  icon?: LucideIcon;
  variant?: "default" | "dashboard";
  onClick?: () => void;
}

const colorMap = {
  brand: {
    bg: "bg-[#F0F9FF]",
    text: "text-primary",
    border: "border-[#B3E5FC]/50",
    iconBg: "bg-[#0088D1]/10",
    circleBg: "bg-[#0088D1]",
  },
  success: {
    bg: "bg-[#F0FDF4]",
    text: "text-[#10B981]",
    border: "border-[#BBF7D0]/50",
    iconBg: "bg-[#10B981]/10",
    circleBg: "bg-[#10B981]",
  },
  warning: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#F59E0B]",
    border: "border-[#FEF3C7]/50",
    iconBg: "bg-[#F59E0B]/10",
    circleBg: "bg-[#F59E0B]",
  },
  error: {
    bg: "bg-[#FEF2F2]",
    text: "text-[#EF4444]",
    border: "border-[#FECACA]/50",
    iconBg: "bg-[#EF4444]/10",
    circleBg: "bg-[#EF4444]",
  },
};

export default function StatCard({
  label,
  value,
  sub,
  color = "brand",
  icon: Icon,
  variant = "default",
  onClick,
}: StatCardProps) {
  const styles = colorMap[color];

  const len = value.length;
  const valueSizeClass =
    len <= 8 ? "text-3xl" : len <= 11 ? "text-2xl" : len <= 14 ? "text-xl" : "text-lg";

  if (variant === "dashboard") {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden bg-card rounded-[8px] border border-border p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group flex items-center gap-4 ${
          onClick ? "cursor-pointer hover:border-primary/50" : ""
        }`}
      >
        {Icon && (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${
            color === "brand" ? "from-[#0088D1] to-[#004A99]" :
            color === "success" ? "from-[#10B981] to-[#059669]" :
            color === "warning" ? "from-[#FFB300] to-[#D97706]" :
            "from-[#EF4444] to-[#B91C1C]"
          } flex items-center justify-center text-white shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.05)] transition-transform duration-300 group-hover:scale-110`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
        )}
        <div className="space-y-1 min-w-0 flex-1 z-10">
          <p className="text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider leading-none">{label}</p>
          <div className="flex flex-col items-start gap-1">
            <p className={`${valueSizeClass} font-black tracking-tight ${styles.text} whitespace-nowrap leading-none transition-transform duration-300 group-hover:scale-105 origin-left`}>
              {value}
            </p>
            {sub && <p className="text-muted-foreground/80 text-xs font-semibold leading-none">{sub}</p>}
          </div>
        </div>
        
        {/* Decorative background organic curves (sparklines) */}
        {color === "brand" && (
          <svg className="absolute right-0 bottom-0 w-28 h-12 pointer-events-none z-0 transition-all duration-300 group-hover:scale-105 group-hover:translate-x-1" viewBox="0 0 100 40" fill="none">
            <defs>
              <linearGradient id="brand-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0088D1" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#0088D1" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0 30 C 15 35, 30 15, 45 20 C 60 25, 75 10, 100 5 L 100 40 L 0 40 Z" fill="url(#brand-grad)" />
            <path d="M0 30 C 15 35, 30 15, 45 20 C 60 25, 75 10, 100 5" stroke="#0088D1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {color === "success" && (
          <svg className="absolute right-0 bottom-0 w-28 h-12 pointer-events-none z-0 transition-all duration-300 group-hover:scale-105 group-hover:translate-x-1" viewBox="0 0 100 40" fill="none">
            <defs>
              <linearGradient id="success-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0 35 C 20 20, 40 40, 60 15 C 80 10, 90 25, 100 12 L 100 40 L 0 40 Z" fill="url(#success-grad)" />
            <path d="M0 35 C 20 20, 40 40, 60 15 C 80 10, 90 25, 100 12" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {color === "warning" && (
          <svg className="absolute right-0 bottom-0 w-28 h-12 pointer-events-none z-0 transition-all duration-300 group-hover:scale-105 group-hover:translate-x-1" viewBox="0 0 100 40" fill="none">
            <defs>
              <linearGradient id="warning-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0 25 C 20 15, 40 35, 60 10 C 80 25, 90 5, 100 18 L 100 40 L 0 40 Z" fill="url(#warning-grad)" />
            <path d="M0 25 C 20 15, 40 35, 60 10 C 80 25, 90 5, 100 18" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {color === "error" && (
          <svg className="absolute right-0 bottom-0 w-28 h-12 pointer-events-none z-0 transition-all duration-300 group-hover:scale-105 group-hover:translate-x-1" viewBox="0 0 100 40" fill="none">
            <defs>
              <linearGradient id="error-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d="M0 20 C 25 40, 50 15, 75 30 C 85 20, 95 10, 100 5 L 100 40 L 0 40 Z" fill="url(#error-grad)" />
            <path d="M0 20 C 25 40, 50 15, 75 30 C 85 20, 95 10, 100 5" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-card rounded-xl border ${styles.border} dark:border-border p-5 shadow-sm dark:shadow-none transition-all hover:shadow-md hover:-translate-y-0.5 group ${
        onClick ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className={`${valueSizeClass} font-black tracking-tight ${styles.text} whitespace-nowrap`}>{value}</p>
            {sub && <p className="text-muted-foreground/80 text-[11px] font-medium">{sub}</p>}
          </div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${styles.iconBg} ${styles.text} transition-colors group-hover:bg-opacity-20`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
        )}
      </div>
      {/* Decorative background element */}
      <div className={`absolute -right-4 -bottom-4 size-24 rounded-full opacity-[0.03] dark:opacity-[0.08] group-hover:opacity-[0.05] dark:group-hover:opacity-[0.12] transition-opacity ${styles.bg}`} />
    </div>
  );
}
