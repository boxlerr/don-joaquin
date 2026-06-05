"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Calendar,
  Hash,
  DollarSign,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { getDmYpfPdfUrlAction, type DmYpfRow } from "./actions";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function formatARS(n: number | null): string {
  if (n == null) return "—";
  return `$ ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DmYpfListClient({
  dms,
  embedded = false,
}: {
  dms: DmYpfRow[];
  /** Cuando es true, no renderiza el header con "Volver" ni el título —
   * se asume que el wrapper ya los muestra. */
  embedded?: boolean;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDescargar = (dm: DmYpfRow) => {
    setDownloadingId(dm.id);
    setDownloadError(null);
    startTransition(async () => {
      const res = await getDmYpfPdfUrlAction(dm.id);
      setDownloadingId(null);
      if (res.error || !res.url) {
        setDownloadError(res.error ?? "No se pudo abrir el PDF");
        return;
      }
      // Abrir en pestaña nueva — el navegador decide si previsualiza o descarga
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-foreground text-xl font-bold">
              Documentos de Medición — YPF
            </h1>
            <p className="text-muted-foreground text-sm">
              Cada DM es la papeleta quincenal firmada por YPF que certifica las
              toneladas y el total a facturar.
            </p>
          </div>
          <Link
            href="/viajes"
            prefetch
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <FileText size={14} />
            Importar nuevo DM (desde Viajes)
          </Link>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Cada DM es la papeleta quincenal firmada por YPF que certifica las
            toneladas y el total a facturar.
          </p>
          <Link
            href="/viajes"
            prefetch
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <FileText size={13} />
            Importar PDF de YPF
          </Link>
        </div>
      )}

      {downloadError && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#7F1D1D] text-sm rounded-lg px-3 py-2">
          {downloadError}
        </div>
      )}

      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/40">
          <FileText size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">
            DMs cargados
          </h2>
          <span className="text-xs text-muted-foreground/70 ml-1">
            {dms.length}
          </span>
        </div>

        {dms.length === 0 ? (
          <div className="py-12 px-5">
            <EmptyState
              icon={FileText}
              message="Todavía no hay DMs cargados"
            />
            <p className="text-center text-xs text-muted-foreground/70 mt-2 -mt-6">
              Importá el primer PDF de YPF desde el módulo de Viajes para verlo acá.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {dms.map((dm) => (
              <li
                key={dm.id}
                className="px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Período + estado */}
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Calendar size={13} className="text-primary" />
                        {formatFecha(dm.periodo_desde)}
                        {" → "}
                        {formatFecha(dm.periodo_hasta)}
                      </span>
                      <StatusBadge
                        label={dm.estado}
                        tone={dm.estado === "conciliado" ? "success" : "info"}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {dm.numero_solpe && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Hash size={10} /> Solpe {dm.numero_solpe}
                        </span>
                      )}
                      {dm.numero_pedido && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Hash size={10} /> Pedido {dm.numero_pedido}
                        </span>
                      )}
                      {dm.solicitante && (
                        <span>· Solic. {dm.solicitante}</span>
                      )}
                      {dm.fecha_certificacion && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 size={10} className="text-[#10B981]" />
                          Firmado {formatFecha(dm.fecha_certificacion)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                        <Clock size={10} />
                        Importado {formatFecha(dm.importado_en)}
                      </span>
                    </div>
                  </div>

                  {/* Total certificado */}
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">
                      Total certificado
                    </div>
                    <div className="text-sm font-mono font-bold text-foreground inline-flex items-center gap-1">
                      <DollarSign
                        size={12}
                        className="text-[#10B981] shrink-0"
                      />
                      {formatARS(dm.total_certificado_ars)}
                    </div>
                  </div>

                  {/* Viajes vinculados */}
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">
                      Viajes
                    </div>
                    <Link
                      href={`/viajes?dm_ypf=${dm.id}`}
                      prefetch
                      className="text-sm font-mono font-bold inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Truck size={12} />
                      {dm.viajes_count}
                    </Link>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDescargar(dm)}
                      disabled={!dm.archivo_id || downloadingId === dm.id}
                      title={
                        dm.archivo_id
                          ? "Abrir / descargar PDF firmado por YPF"
                          : "Este DM no tiene PDF original (importado antes del MVP)"
                      }
                    >
                      <Download size={13} />
                      {downloadingId === dm.id ? "Abriendo..." : "PDF"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
