"use client";

import { useRouter } from "next/navigation";

export default function AnioSelector({
  anios,
  anioActual,
}: {
  anios: number[];
  anioActual: number;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {anios.map((a) => {
        const activo = a === anioActual;
        return (
          <button
            key={a}
            type="button"
            onClick={() => router.push(`/choferes/rotacion?anio=${a}`)}
            className={`h-8 px-3 text-sm rounded-md border transition-colors ${
              activo
                ? "border-[#0088D1] bg-[#0088D1] text-white font-semibold"
                : "border-border bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}
