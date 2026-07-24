import Link from "next/link";
import { CalendarOff, ShieldCheck } from "lucide-react";
import { formatFecha } from "@/lib/utils";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import type { AusenciaProxima } from "../actions";

interface Props {
  ausencias: AusenciaProxima[];
  dias: number;
}

// Sección de disponibilidad: choferes no disponibles en los próximos días, para
// planificar la semana sin depender de "lo que recordó" logística.
export default function DisponibilidadChoferes({ ausencias, dias }: Props) {
  const choferesDistintos = new Set(ausencias.map((a) => a.chofer_id)).size;

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary">
            <CalendarOff size={15} />
          </span>
          <h2 className="text-foreground text-sm font-semibold">
            Disponibilidad — próximos {dias} días
          </h2>
        </div>
        {choferesDistintos > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {choferesDistintos} chofer{choferesDistintos !== 1 ? "es" : ""} menos
          </span>
        )}
      </div>

      <div className="p-5">
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
                className="group flex items-start gap-3 rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm transition-all"
              >
                <InitialsAvatar name={a.chofer_nombre} size={40} className="mt-0.5 text-[13px]" />

                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {a.chofer_nombre}
                  </span>

                  <p className="text-xs font-semibold text-foreground/70 mt-0.5 flex items-center gap-1.5">
                    {a.en_curso && (
                      <span
                        className="size-1.5 rounded-full bg-amber-500 shrink-0"
                        title="Actualmente ausente"
                      />
                    )}
                    De {a.tipo.toLowerCase()}
                  </p>

                  <p className="text-[11px] text-foreground/70 font-semibold mt-1.5 tabular-nums">
                    {formatFecha(a.fecha_inicio)}
                    {a.fecha_inicio !== a.fecha_fin && (
                      <>
                        <span className="mx-1 text-muted-foreground/50">→</span>
                        {formatFecha(a.fecha_fin)}
                      </>
                    )}
                  </p>

                  {a.autorizado_por_nombre && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5 flex items-center gap-1">
                      <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
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
