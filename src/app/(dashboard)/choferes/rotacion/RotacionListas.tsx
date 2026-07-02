"use client";

import { useRouter } from "next/navigation";
import { choferSlug } from "@/lib/chofer-slug";
import type { AltaDelAnio, EgresadoDelAnio } from "./lib";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Tablas de Ingresos y Egresados del año, con filas que llevan al legajo. */
export default function RotacionListas({
  anio,
  altas,
  egresados,
}: {
  anio: number;
  altas: AltaDelAnio[];
  egresados: EgresadoDelAnio[];
}) {
  const router = useRouter();
  const irAlLegajo = (c: { apellido: string; nombre: string }) =>
    router.push(`/choferes/${choferSlug(c)}`);

  return (
    <div className="space-y-4">
      {/* Ingresos del año */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Ingresos de {anio}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {["Chofer", "Localidad", "Ingreso", "Estado actual"].map((h) => (
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
              {altas.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => irAlLegajo(a)}
                  title="Ver legajo"
                  className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-foreground hover:text-primary hover:underline">
                    {a.apellido}, {a.nombre}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{a.localidad ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-foreground">{fmtFecha(a.fecha_ingreso)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {a.estado === "baja" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Egresado
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Activo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {altas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hubo ingresos en {anio}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Egresados del año */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Egresados de {anio}</h2>
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
              {egresados.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => irAlLegajo(e)}
                  title="Ver legajo"
                  className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-foreground hover:text-primary hover:underline">
                    {e.apellido}, {e.nombre}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{e.localidad ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtFecha(e.fecha_ingreso)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-foreground">
                    {fmtFecha(e.fecha_egreso)}
                    {e.fecha_aprox && (
                      <span
                        className="ml-1.5 text-amber-600 font-mono"
                        title="Fecha aproximada: es cuando se registró la baja, no un egreso cargado. Corregila desde el legajo."
                      >
                        ≈
                      </span>
                    )}
                  </td>
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
              {egresados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hubo egresos en {anio}.
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
