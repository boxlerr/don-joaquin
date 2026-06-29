"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

interface MesSelectorProps {
  currentMonth: string;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function MesSelector({ currentMonth }: MesSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = useMemo(() => {
    const opts = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      const value = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[m]} ${y}${i === 0 ? " (Mes actual)" : ""}`;

      opts.push({ id: value, label });
    }

    return opts;
  }, []);

  const activeValue = useMemo(() => {
    if (currentMonth) return currentMonth;
    // Por defecto el mes actual (primer opción)
    return options[0]?.id || "";
  }, [currentMonth, options]);

  const handleMonthChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== options[0]?.id) {
      params.set("month", val);
    } else {
      params.delete("month");
    }
    // Al cambiar de período, reseteamos a la página 0
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="relative flex items-center">
      <Calendar
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground pointer-events-none"
      />
      <Combobox
        value={activeValue}
        onValueChange={handleMonthChange}
        options={options}
        searchable={false}
        placeholder="Seleccionar mes..."
        triggerClassName="h-9 min-w-[210px] pl-9"
      />
    </div>
  );
}
