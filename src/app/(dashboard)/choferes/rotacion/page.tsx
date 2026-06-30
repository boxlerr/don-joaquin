import { requireSeccion } from "@/lib/auth";
import PageHeader from "@/components/layout/PageHeader";
import Link from "next/link";
import { Users, UserPlus, UserMinus, Percent, RefreshCw, AlertTriangle } from "lucide-react";
import AnioSelector from "./AnioSelector";
import { getRotacion } from "./lib";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function RotacionChoferes({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  await requireSeccion("choferes_rotacion", "read");

  const { anio: anioParam } = await searchParams;
  const anioNum = anioParam && /^\d{4}$/.test(anioParam) ? Number(anioParam) : undefined;
  const { data, anios, egresados_sin_fecha } = await getRotacion(anioNum);

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

      {egresados_sin_fecha > 0 && (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Hay <strong>{egresados_sin_fecha}</strong> chofer(es) dados de baja sin fecha de egreso cargada.
            No se computan en la rotación de ningún año — completá la fecha de egreso desde su legajo para incluirlos.
          </span>
        </div>
      )}

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

      {/* Detalle de egresados */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Egresados de {data.anio}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Localidad", "Ingreso", "Egreso", "Antigüedad", "Motivo"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs border-b border-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.egresados.map((e) => (
                <tr key={e.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-foreground">
                    {e.apellido}, {e.nombre}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{e.localidad ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtFecha(e.fecha_ingreso)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-foreground">{fmtFecha(e.fecha_egreso)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                    {e.antiguedad_anios !== null ? `${e.antiguedad_anios} años` : "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {e.motivo}
                    </span>
                  </td>
                </tr>
              ))}
              {data.egresados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hubo egresos en {data.anio}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
