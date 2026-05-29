"use client";

import { usePathname, useRouter } from "next/navigation";

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

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId === otherId) return;
    const params = new URLSearchParams(periodoQuery);
    params.set("a", side === "a" ? newId : otherId);
    params.set("b", side === "b" ? newId : otherId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      value={selectedId}
      onChange={onChange}
      className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {choferes.map((c) => (
        <option key={c.id} value={c.id} disabled={c.id === otherId}>
          {c.apellido}, {c.nombre}
          {c.id === otherId ? " (ya elegido)" : ""}
        </option>
      ))}
    </select>
  );
}
