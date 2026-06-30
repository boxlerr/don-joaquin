"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import MonthPicker from "@/components/ui/MonthPicker";

interface MesSelectorProps {
  currentMonth: string;
}

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MesSelector({ currentMonth }: MesSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hoy = mesActual();
  const value = currentMonth || hoy;

  const handleMonthChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== hoy) {
      params.set("month", val);
    } else {
      params.delete("month"); // mes actual → sin parámetro
    }
    params.delete("page"); // al cambiar de período, volver a la primera página
    router.push(`${pathname}?${params.toString()}`);
  };

  return <MonthPicker value={value} onChange={handleMonthChange} />;
}
