import Link from "next/link";
import { CalendarOff, ShieldCheck } from "lucide-react";
import { formatFecha } from "@/lib/utils";
import AvatarPersona from "@/components/ui/AvatarPersona";
import type { AusenciaProxima } from "../actions";

interface Props {
  ausencias: AusenciaProxima[];
  dias: number;
}

/** "en 2 días" / "mañana" / "hoy", para decir cuándo se va sin hacer cuentas. */
function cuando(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

/**
 * Estado de quien hoy no está, nombrando el motivo: "En vacaciones" dice más
 * que "no está". `tipo` es texto libre en la base (hoy solo hay "vacaciones"),
 * así que la preposición se elige por el tipo y hay fallback genérico.
 */
function estadoAusente(tipo: string): string {
  const t = tipo.toLowerCase().trim();
  if (t.startsWith("vacacion")) return "En vacaciones";
  if (t.startsWith("licencia")) return `De ${t}`;
  if (t.startsWith("permiso") || t.startsWith("franco")) return `De ${t}`;
  return `No está hoy · ${t}`;
}

// Sección de disponibilidad: quién NO está hoy y quién se va en los próximos
// días. La distinción importa para asignar viajes: a alguien que se va el lunes
// todavía se le puede dar un viaje hoy.
export default function DisponibilidadChoferes({ ausencias, dias }: Props) {
  const ausentesHoy = new Set(ausencias.filter((a) => a.en_curso).map((a) => a.chofer_id)).size;
  const porSalir = new Set(
    ausencias.filter((a) => !a.en_curso).map((a) => a.chofer_id),
  ).size;

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary shrink-0">
            <CalendarOff size={15} />
          </span>
          <h2 className="text-foreground text-sm font-semibold">
            Disponibilidad — próximos {dias} días
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ausentesHoy > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {ausentesHoy} sin disponibilidad hoy
            </span>
          )}
          {porSalir > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {porSalir} {porSalir === 1 ? "se va" : "se van"} en los próximos días
            </span>
          )}
        </div>
      </div>

      <div className="p-3 sm:p-5">
        {ausencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay ausencias ni permisos cargados para los próximos {dias} días.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ausencias.map((a) => (
              <Link
                key={a.id}
                href={`/choferes/${a.chofer_id}?tab=ausencias`}
                className={`group flex items-start gap-3 rounded-lg border p-3 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm ${
                  a.en_curso ? "border-amber-500/40" : "border-border"
                }`}
              >
                <AvatarPersona name={a.chofer_nombre} rol="chofer" size={40} className="mt-0.5 shrink-0" />

                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {a.chofer_nombre}
                  </span>

                  {/* Lo primero es si está o no está HOY; el tipo de ausencia va después. */}
                  {a.en_curso ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                      {estadoAusente(a.tipo)}
                      <span className="font-normal text-muted-foreground">
                        · vuelve el {formatFecha(a.fecha_regreso)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-foreground/70">
                      <span className="size-1.5 shrink-0 rounded-full border border-muted-foreground/40" />
                      Disponible
                      <span className="font-normal text-muted-foreground">
                        · se va {cuando(a.dias_hasta_inicio)}
                      </span>
                    </p>
                  )}

                  <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {/* El tipo solo se repite acá si arriba no se nombró (los que
                        todavía están dicen "Disponible", no el motivo). */}
                    {!a.en_curso && (
                      <>
                        <span className="capitalize">{a.tipo.toLowerCase()}</span>
                        {" · "}
                      </>
                    )}
                    {formatFecha(a.fecha_inicio)}
                    {a.fecha_inicio !== a.fecha_fin && (
                      <>
                        <span className="mx-1 text-muted-foreground/50">→</span>
                        {formatFecha(a.fecha_fin)}
                      </>
                    )}
                  </p>

                  {a.autorizado_por_nombre && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                      <ShieldCheck size={11} className="shrink-0 text-emerald-500" />
                      <span className="truncate">{a.autorizado_por_nombre}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
