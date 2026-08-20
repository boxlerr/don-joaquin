import Link from "next/link";
import { Fuel, TriangleAlert } from "lucide-react";
import type { ConsumoPeriodo } from "@/app/(dashboard)/combustible/actions";

interface Props {
  consumo: ConsumoPeriodo;
  /** Los importes ($ del gasoil, $/L) solo en /dashboard/completo. */
  mostrarImportes: boolean;
}

function fmtNum(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: dec });
}

function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `$ ${(n / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  return `$ ${fmtNum(n)}`;
}

function fmtFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Gasoil cargado mes a mes dentro del período, a lo ancho del tablero. Las
 * barras son divs con alto porcentual: para doce números no hace falta una
 * librería de gráficos, y así la tarjeta también se dibuja en el server.
 *
 * Los meses sin cargas se dibujan y se rotulan como tales. La primera versión
 * los dejaba como una rayita gris y el gráfico parecía roto, cuando en realidad
 * lo que pasa es que dejaron de cargarse gasoiles — por eso ahora, si el
 * período termina en cero, la tarjeta dice desde cuándo.
 */
export default function ConsumoCombustible({ consumo, mostrarImportes }: Props) {
  const {
    meses,
    litrosTotales,
    eficienciaPromedio,
    precioPromedioLitro,
    cargasTotales,
    importeTotal,
    ultimaCarga,
  } = consumo;

  const maxLitros = Math.max(...meses.map((m) => m.litros), 0);
  // Con más de 12 meses en pantalla las barras quedan hilos: se muestran los
  // últimos 12, que es lo que entra cómodo y lo que se suele mirar.
  const visibles = meses.slice(-12);
  // Si los últimos meses del período no tienen ni una carga, el gráfico no está
  // roto: se dejó de cargar. Vale la pena decirlo con todas las letras.
  const mesesSinCargaAlFinal = (() => {
    let n = 0;
    for (let i = visibles.length - 1; i >= 0 && visibles[i].cargas === 0; i--) n++;
    return n;
  })();
  const hayCorte = ultimaCarga !== null && mesesSinCargaAlFinal > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-[#D97706]" />
          <h2 className="text-sm font-bold text-foreground">Consumo de combustible</h2>
        </div>
        <Link
          href="/combustible"
          className="inline-flex shrink-0 items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          Ver detalle →
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-5">
        {/* Los números del período, a la izquierda. */}
        <div className="flex shrink-0 flex-row flex-wrap gap-x-6 gap-y-3 sm:w-[210px] sm:flex-col sm:gap-y-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase leading-none tracking-wider text-muted-foreground">
              Rendimiento promedio
            </p>
            {eficienciaPromedio != null ? (
              <p className="mt-1.5 whitespace-nowrap text-[28px] font-black leading-none tracking-tight text-[#D97706]">
                {fmtNum(eficienciaPromedio, 1)}
                <span className="ml-1 text-xs font-bold text-muted-foreground">L/100km</span>
              </p>
            ) : (
              <p className="mt-1.5 text-sm font-bold text-muted-foreground">Sin datos suficientes</p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase leading-none tracking-wider text-muted-foreground">
              Cargado en el período
            </p>
            <p className="mt-1.5 text-lg font-black leading-none text-foreground">
              {fmtNum(litrosTotales)} <span className="text-xs font-bold text-muted-foreground">L</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground/85">
              {cargasTotales} carga{cargasTotales === 1 ? "" : "s"}
              {mostrarImportes && precioPromedioLitro != null && (
                <> · {fmtMoneyCompact(importeTotal)} · $ {fmtNum(precioPromedioLitro)}/L</>
              )}
            </p>
          </div>

          {hayCorte && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 sm:mt-auto">
              <TriangleAlert size={13} className="mt-px shrink-0 text-amber-600" />
              <p className="text-[11px] leading-snug text-amber-800">
                Sin cargas desde el <strong>{fmtFechaCorta(ultimaCarga!)}</strong>.
                {" "}Los últimos {mesesSinCargaAlFinal === 1 ? "mes está" : `${mesesSinCargaAlFinal} meses están`} en cero
                porque no se registró gasoil, no porque no se haya consumido.
              </p>
            </div>
          )}
        </div>

        {/* El gráfico ocupa todo el resto del ancho. */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {maxLitros > 0 ? (
            <>
              {/* Cada barra es hija directa de un contenedor que se estira: así
                  el alto en porcentaje tiene contra qué resolverse. */}
              <div className="flex max-h-[180px] min-h-[104px] flex-1 items-stretch gap-2 sm:gap-3">
                {visibles.map((m) => {
                  const alto = m.litros > 0 ? Math.max(4, (m.litros / maxLitros) * 100) : 0;
                  return (
                    <div key={m.mes} className="group relative flex-1">
                      {m.litros > 0 ? (
                        <span
                          className="absolute bottom-0 left-1/2 w-full max-w-[54px] -translate-x-1/2 rounded-t-[5px] bg-gradient-to-t from-[#0088D1] to-[#4FC3F7] transition-opacity group-hover:opacity-85"
                          style={{ height: `${alto}%` }}
                          title={`${m.label}: ${fmtNum(m.litros)} L${m.eficiencia != null ? ` · ${fmtNum(m.eficiencia, 1)} L/100km` : ""}`}
                        />
                      ) : (
                        // Mes sin cargas: caja punteada del alto completo, que se
                        // lee como "acá no hay dato" y no como "acá hay cero".
                        <span
                          className="absolute inset-0 rounded-[5px] border border-dashed border-border bg-muted/25"
                          title={`${m.label}: sin cargas registradas`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 sm:gap-3">
                {visibles.map((m) => (
                  <span
                    key={m.mes}
                    className={`flex-1 text-center text-[10px] font-bold uppercase ${
                      m.cargas === 0 ? "text-muted-foreground/40" : "text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] font-medium text-muted-foreground/70">
                Litros cargados por mes · el punteado son meses sin cargas registradas
              </p>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-8 text-center">
              <Fuel size={20} className="text-muted-foreground/50" />
              <p className="text-xs font-semibold text-foreground">Sin cargas en el período</p>
              <p className="max-w-[280px] text-[11px] text-muted-foreground">
                No hay gasoil registrado entre estas fechas. Probá con otro período o importá el resumen de YPF.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
