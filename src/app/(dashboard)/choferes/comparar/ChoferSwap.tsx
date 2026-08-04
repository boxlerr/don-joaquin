"use client";

import { usePathname, useRouter } from "next/navigation";
import { Combobox } from "@/components/ui/combobox";

interface Props {
  side: "a" | "b";
  choferes: Array<{ id: string; nombre: string; apellido: string }>;
  selectedId: string;
  otherId: string;
  periodoQuery: string;
}

export default function ChoferSwap({
  side,
  choferes,
  selectedId,
  otherId,
  periodoQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const onValueChange = (newId: string) => {
    if (!newId || newId === otherId) return;
    const params = new URLSearchParams(periodoQuery);
    params.set("a", side === "a" ? newId : otherId);
    params.set("b", side === "b" ? newId : otherId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Combobox
      value={selectedId}
      onValueChange={onValueChange}
      options={choferes.map((c) => ({
        id: c.id,
        label: `${c.apellido}, ${c.nombre}${c.id === otherId ? " (ya elegido)" : ""}`,
        disabled: c.id === otherId,
      }))}
      searchPlaceholder="Buscar chofer..."
      triggerClassName="h-9 sm:h-8 w-full"
    />
  );
}
