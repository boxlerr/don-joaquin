import { requireSeccion } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { Users, UserPlus, UserMinus, Percent, RefreshCw } from "lucide-react";
import AnioSelector from "./AnioSelector";
import RotacionListas from "./RotacionListas";
import { getRotacion } from "./lib";

export default async function RotacionChoferes({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  await requireSeccion("choferes_rotacion", "read");

  const { anio: anioParam } = await searchParams;
  const anioNum = anioParam && /^\d{4}$/.test(anioParam) ? Number(anioParam) : undefined;
  const { data, anios } = await getRotacion(anioNum);

  const maxMotivo = Math.max(1, ...data.por_motivo.map((m) => m.count));

  const cards = [
    {
      label: "Dotación actual",
      value: String(data.dotacion_actual),
      hint: "choferes activos hoy",
      icon: Users,
      tone: "text-foreground",
    },
    {
      label: `Altas ${data.anio}`,
      value: String(data.altas),
      hint: "ingresos en el año",
      icon: UserPlus,
      tone: "text-emerald-600",
    },
    {
      label: `Bajas ${data.anio}`,
      value: String(data.bajas),
      hint: "egresos en el año",
      icon: UserMinus,
      tone: "text-red-600",
    },
    {
      label: "Índice de rotación",
      value: `${data.indice_rotacion}%`,
      hint: `bajas ÷ dotación promedio (${data.dotacion_promedio})`,
      icon: Percent,
      tone: "text-[#0088D1]",
    },
  ];

  return (
    <div className="p-8 space-y-4">
      <PageHeader
        title="Índice de rotación"
        description={`Altas, bajas y rotación de choferes · Año ${data.anio}`}
        action={
          <Link
            href="/choferes"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Users size={14} />
            Ver legajos
          </Link>
        }
      />

      <AnioSelector anios={anios} anioActual={data.anio} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card border border-border rounded-[8px] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Icon size={14} />
                {c.label}
              </div>
              <p className={`mt-2 text-3xl font-bold ${c.tone}`}>{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground/80">{c.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Desglose por motivo + antigüedad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-[8px] p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Bajas por motivo</h2>
          {data.por_motivo.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin bajas registradas en {data.anio}.</p>
          ) : (
            <div className="space-y-2.5">
              {data.por_motivo.map((m) => (
                <div key={m.motivo} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-foreground">{m.label}</span>
                  <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#0088D1]/80 rounded"
                      style={{ width: `${(m.count / maxMotivo) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold text-foreground">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-[8px] p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <RefreshCw size={14} />
            Antigüedad al egresar
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {data.antiguedad_promedio_bajas !== null ? `${data.antiguedad_promedio_bajas} años` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">promedio de los que se fueron en {data.anio}</p>
        </div>
      </div>

      {/* Ingresos y egresados del año — filas clickeables al legajo */}
      <RotacionListas anio={data.anio} altas={data.altas_detalle} egresados={data.egresados} />
    </div>
  );
}
