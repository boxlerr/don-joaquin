import Link from "next/link";
import { Gauge } from "lucide-react";

interface Props {
  kmConCarga: number;
  kmVacios: number;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

/**
 * Tarjeta oscura del aprovechamiento: qué parte de los km que rodó la flota en
 * el período fue con carga. Es el mismo par de números que la tarjeta de "km
 * vacíos", mirado al revés — acá interesa el que conviene que suba.
 */
export default function RendimientoFlota({ kmConCarga, kmVacios }: Props) {
  const kmTotal = kmConCarga + kmVacios;
  const pctCarga = kmTotal > 0 ? (kmConCarga / kmTotal) * 100 : 0;
  const pctVacio = 100 - pctCarga;

  return (
    <div className="relative isolate flex min-h-[212px] flex-col overflow-hidden rounded-[12px] bg-[#05121F] shadow-[0_10px_26px_-14px_rgba(2,12,24,0.8)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorativa y fija: no hay nada que optimizar */}
      <img
        src="/dashboard/flota-noche.jpg"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[center_52%]"
      />
      {/* Un velo parejo para que el texto se lea en celular (donde la foto queda
          debajo de todo) y otro lateral que deja asomar el camión a la izquierda. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, rgba(3,12,22,0.04) 0%, rgba(3,12,22,0.34) 30%, rgba(3,12,22,0.80) 58%, rgba(3,12,22,0.95) 100%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge size={15} className="text-[#4FC3F7]" strokeWidth={2.4} />
            <h2 className="text-sm font-bold text-white">Aprovechamiento de la flota</h2>
          </div>
          <Link
            href="/metricas"
            className="inline-flex shrink-0 items-center max-md:h-9 text-[11px] font-semibold text-[#4FC3F7] transition-colors hover:text-white"
          >
            Métricas →
          </Link>
        </div>

        <div className="ml-auto w-full max-w-[280px] text-right">
          <p className="text-[44px] font-black leading-none tracking-tight text-white sm:text-[52px]">
            {pctCarga.toFixed(0)}
            <span className="text-2xl font-extrabold text-white/70">%</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold text-white/70">
            de los km del período fueron con carga
          </p>
        </div>

        <div>
          {/* La barra es el mismo dato que el número, pero deja ver el reparto:
              cuánto se recorrió cargado y cuánto volviendo vacío. */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/12">
            <span
              className="h-full shrink-0 rounded-l-full bg-gradient-to-r from-[#4FC3F7] to-[#0088D1]"
              style={{ width: `${pctCarga.toFixed(2)}%` }}
            />
            <span
              className="h-full shrink-0 bg-[#EF4444]/70"
              style={{ width: `${pctVacio.toFixed(2)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <span className="size-2 rounded-full bg-[#4FC3F7]" aria-hidden />
              <span className="font-bold tabular-nums text-white">{fmtNum(kmConCarga)} km</span> con carga
            </span>
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <span className="size-2 rounded-full bg-[#EF4444]/80" aria-hidden />
              <span className="font-bold tabular-nums text-white">{fmtNum(kmVacios)} km</span> vacíos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
