"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { choferSlug } from "@/lib/chofer-slug";

export type ChoferLocalidad = {
  id: string;
  nombre: string;
  apellido: string;
  estado: string;
};

export type LocalidadData = {
  localidad: string;
  cantidad: number;
  choferes: ChoferLocalidad[];
};

const COLOR_PRINCIPAL = "#0088D1";
const COLOR_RESTO = "#93C5FD";

export default function ChoferesLocalidadChart({ data }: { data: LocalidadData[] }) {
  const [selected, setSelected] = useState<LocalidadData | null>(null);

  if (data.length === 0) return null;

  const top = data[0];

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">Distribución por localidad</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choferes activos e inactivos agrupados por localidad de residencia — hacé click en una
          barra para ver quiénes son
        </p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
          onClick={(state) => {
            const entry = data.find((d) => d.localidad === state?.activeLabel);
            if (entry) setSelected(entry);
          }}
        >
          <XAxis
            dataKey="localidad"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as LocalidadData;
              return (
                <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                  <p className="font-semibold text-foreground">{d.localidad}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {d.cantidad} {d.cantidad === 1 ? "chofer" : "choferes"}
                  </p>
                  <p className="text-primary mt-1">Click para ver quiénes son</p>
                </div>
              );
            }}
          />
          <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.localidad}
                cursor="pointer"
                fill={entry.localidad === top.localidad ? COLOR_PRINCIPAL : COLOR_RESTO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MapPin size={15} className="text-primary shrink-0" />
              {selected?.localidad}
              <span className="text-xs font-normal text-muted-foreground">
                {selected?.cantidad} {selected?.cantidad === 1 ? "chofer" : "choferes"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {selected?.choferes.map((c) => (
              <Link
                key={c.id}
                href={`/choferes/${choferSlug(c)}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="size-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {`${c.nombre[0] ?? ""}${c.apellido[0] ?? ""}`.toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {c.apellido}, {c.nombre}
                </span>
                <StatusBadge
                  label={c.estado}
                  tone={c.estado === "activo" ? "success" : "neutral"}
                />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
