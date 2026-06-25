import Link from "next/link";
import { CalendarOff, ShieldCheck } from "lucide-react";
import { formatFecha } from "@/lib/utils";
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
    <div className="bg-card rounded-[8px] border border-border shadow-sm mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <CalendarOff size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            Disponibilidad — próximos {dias} días
          </h2>
        </div>
        {choferesDistintos > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
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
                className="block rounded-[8px] border border-border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {a.chofer_nombre}
                  </span>
                  {a.en_curso && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7] flex-shrink-0">
                      En curso
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90">{a.tipo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatFecha(a.fecha_inicio)}
                  {a.fecha_inicio !== a.fecha_fin && (
                    <>
                      <span className="mx-1">→</span>
                      {formatFecha(a.fecha_fin)}
                    </>
                  )}
                </p>
                {a.autorizado_por_nombre && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-500" />
                    {a.autorizado_por_nombre}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
