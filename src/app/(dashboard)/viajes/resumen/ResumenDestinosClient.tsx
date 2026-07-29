"use client";

/**
 * Entrar por destino en vez de por chofer.
 *
 * Nico: "hoy paso tres viajes a Lomaser, dos a Escobar; para no tener que
 * entrar chofer por chofer para ver a dónde fue el último viaje que le di".
 *
 * Cada destino se abre y muestra quiénes fueron, con qué camión, cuántos viajes
 * y cuándo fue el último. Los que todavía no tienen chofer se marcan aparte,
 * porque son los que hay que asignar.
 */

import { useState, useTransition } from "react";
import { CalendarRange, ChevronDown, ChevronRight, MapPin, Truck, UserRound } from "lucide-react";
import { getResumenDestinosAction, type ResumenDestinos } from "./actions";

const RANGOS = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "semana", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
] as const;
type RangoId = (typeof RANGOS)[number]["id"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangoDe(id: RangoId, hoy: string): { desde: string; hasta: string } {
  const [y, m, d] = hoy.split("-").map(Number);
  const base = new Date(y!, m! - 1, d!);
  switch (id) {
    case "ayer": {
      const a = new Date(base);
      a.setDate(a.getDate() - 1);
      return { desde: iso(a), hasta: iso(a) };
    }
    case "semana": {
      const a = new Date(base);
      a.setDate(a.getDate() - 6);
      return { desde: iso(a), hasta: hoy };
    }
    case "mes":
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    default:
      return { desde: hoy, hasta: hoy };
  }
}

function fmtFecha(isoFecha: string): string {
  const [y, m, d] = isoFecha.split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="rounded-[8px] border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${tone === "warning" ? "text-[#B45309]" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ResumenDestinosClient({
  inicial,
  hoy,
}: {
  inicial: ResumenDestinos;
  hoy: string;
}) {
  const [datos, setDatos] = useState(inicial);
  const [rango, setRango] = useState<RangoId>("hoy");
  const [abierto, setAbierto] = useState<string | null>(
    // Con un solo destino no tiene sentido obligar a un clic más.
    inicial.destinos.length === 1 ? inicial.destinos[0]!.destino : null,
  );
  const [pendiente, startTransition] = useTransition();

  const cambiarRango = (id: RangoId) => {
    setRango(id);
    const { desde, hasta } = rangoDe(id, hoy);
    startTransition(async () => {
      setDatos(await getResumenDestinosAction(desde, hasta));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => cambiarRango(r.id)}
              aria-pressed={rango === r.id}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                rango === r.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarRange size={13} />
          {datos.desde === datos.hasta
            ? fmtFecha(datos.desde)
            : `${fmtFecha(datos.desde)} – ${fmtFecha(datos.hasta)}`}
          {pendiente && <span className="ml-1 text-primary">actualizando…</span>}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Viajes" value={fmtNum(datos.totales.viajes)} />
        <Kpi label="Destinos" value={fmtNum(datos.totales.destinos)} />
        <Kpi label="Choferes" value={fmtNum(datos.totales.choferes)} />
        <Kpi
          label="Sin chofer"
          value={fmtNum(datos.totales.sinChofer)}
          tone={datos.totales.sinChofer > 0 ? "warning" : undefined}
        />
      </div>

      {datos.destinos.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No hay viajes cargados en este período.
        </div>
      ) : (
        <div className="space-y-1.5">
          {datos.destinos.map((d) => {
            const expandido = abierto === d.destino;
            return (
              <div key={d.destino} className="rounded-[8px] border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setAbierto(expandido ? null : d.destino)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {expandido ? (
                      <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                    )}
                    <MapPin size={14} className="shrink-0 text-primary" />
                    <span className="truncate font-semibold text-foreground">{d.destino}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {d.choferes.length} chofer{d.choferes.length !== 1 ? "es" : ""}
                    </span>
                    {d.sinChofer > 0 && (
                      <span className="shrink-0 rounded-[4px] border border-[#B45309]/40 px-1.5 py-0.5 text-[11px] font-medium text-[#B45309]">
                        {d.sinChofer} sin asignar
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-[12px] tabular-nums text-muted-foreground">
                    {d.toneladas > 0 && <span>{fmtNum(d.toneladas, 1)} tn</span>}
                    {d.km > 0 && <span>{fmtNum(d.km)} km</span>}
                    <span className="text-base font-bold text-foreground">{d.viajes}</span>
                  </span>
                </button>

                {expandido && (
                  <ul className="divide-y divide-border/60 border-t border-border">
                    {d.choferes.length === 0 ? (
                      <li className="px-4 py-3 text-[13px] text-muted-foreground">
                        Ninguno de estos viajes tiene chofer asignado todavía.
                      </li>
                    ) : (
                      d.choferes.map((c) => (
                        <li
                          key={c.chofer_id ?? c.chofer}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <UserRound size={13} className="shrink-0 text-muted-foreground" />
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {c.chofer}
                            </span>
                            {c.camion && (
                              <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                                <Truck size={11} />
                                {c.camion}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 items-center gap-4 text-[12px] text-muted-foreground">
                            <span className="tabular-nums">
                              {c.viajes} viaje{c.viajes !== 1 ? "s" : ""}
                            </span>
                            <span>último el {fmtFecha(c.ultimo)}</span>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
