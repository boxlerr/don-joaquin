interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "brand" | "success" | "warning" | "error";
}

const colorMap = {
  brand: "bg-[#E1F5FE] text-[#0088D1]",
  success: "bg-[#ECFDF5] text-[#10B981]",
  warning: "bg-[#FFFBEB] text-[#F59E0B]",
  error: "bg-[#FEF2F2] text-[#EF4444]",
};

export default function StatCard({ label, value, sub, color = "brand" }: StatCardProps) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-5 shadow-sm">
      <p className="text-[#475569] text-sm font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-[#94A3B8] text-xs mt-1">{sub}</p>}
    </div>
  );
}
