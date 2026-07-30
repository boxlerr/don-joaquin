"use client";

/**
 * Entrar por destino en vez de por chofer.
 *
 * Nico: "hoy paso tres viajes a Lomaser, dos a Escobar; para no tener que
 * entrar chofer por chofer para ver a dónde fue el último viaje que le di".
 *
 * Tres niveles: destino → choferes que fueron → los viajes de cada uno, con
 * fecha, remito, km e importe. Todo acá, sin saltar de pantalla; y cuando hace
 * falta el viaje entero, cada nivel linkea al listado con los mismos filtros ya
 * puestos.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  getMesesConViajesAction,
  getResumenDestinosAction,
  type ResumenDestinos,
  type ViajeDelResumen,
} from "./actions";

const RANGOS = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "semana", label: "7 días" },
  { id: "mes", label: "Este mes" },
] as const;
type RangoId = (typeof RANGOS)[number]["id"] | "personalizado";

const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangoDe(id: Exclude<RangoId, "personalizado">, hoy: string) {
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

/** Primer y último día de un mes "YYYY-MM". */
function rangoDelMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y!, m!, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

function labelMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_LARGO[m! - 1]} ${y}`;
}

function fmtFecha(f: string): string {
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number, dec = 0): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function ars(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Sin acentos ni mayúsculas, para que "escobar" encuentre "(ESCOBAR) MAPEI". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

/** Los viajes de un chofer a ese destino: lo que antes había que ir a buscar. */
function TablaViajes({ viajes, href }: { viajes: ViajeDelResumen[]; href: string }) {
  return (
    <div className="bg-muted/20 px-4 py-2">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1 pr-3 text-left font-medium">Fecha</th>
            <th className="px-2 py-1 text-left font-medium">Desde</th>
            <th className="px-2 py-1 text-left font-medium">Remito</th>
            <th className="px-2 py-1 text-left font-medium">Material</th>
            <th className="px-2 py-1 text-right font-medium">KM</th>
            <th className="px-2 py-1 text-right font-medium">Tn</th>
            <th className="py-1 pl-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {viajes.map((v) => (
            <tr key={v.id} className="text-foreground">
              <td className="py-1.5 pr-3 font-mono text-[11px] whitespace-nowrap">
                {fmtFecha(v.fecha)}
              </td>
              <td className="px-2 py-1.5">{v.origen ?? "—"}</td>
              <td className="px-2 py-1.5 font-mono text-[11px]">{v.remito ?? "—"}</td>
              <td className="max-w-[16rem] truncate px-2 py-1.5 text-muted-foreground">
                {v.material ?? v.cliente ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(v.km)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {v.toneladas ? fmtNum(v.toneladas, 1) : "—"}
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {v.monto != null ? ars(v.monto) : <span className="text-[#B45309]">sin importe</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        href={href}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Abrir en el listado para editarlos <ArrowUpRight size={11} />
      </Link>
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
  const [mes, setMes] = useState<string>(hoy.slice(0, 7));
  const [meses, setMeses] = useState<string[]>([]);
  const [buscarDestino, setBuscarDestino] = useState("");
  const [buscarChofer, setBuscarChofer] = useState("");
  const [destinoAbierto, setDestinoAbierto] = useState<string | null>(null);
  const [choferAbierto, setChoferAbierto] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // Los meses con viajes se piden una vez: alimentan el selector histórico.
  useEffect(() => {
    let vivo = true;
    getMesesConViajesAction().then((m) => {
      if (vivo) setMeses(m);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const cargar = (desde: string, hasta: string) => {
    startTransition(async () => {
      setDatos(await getResumenDestinosAction(desde, hasta));
    });
  };

  const elegirRango = (id: Exclude<RangoId, "personalizado">) => {
    setRango(id);
    const { desde, hasta } = rangoDe(id, hoy);
    cargar(desde, hasta);
  };

  const elegirMes = (m: string) => {
    setMes(m);
    setRango("personalizado");
    const { desde, hasta } = rangoDelMes(m);
    cargar(desde, hasta);
  };

  /** El listado con las mismas fechas y, si hace falta, el destino ya buscado. */
  const hrefListado = (extra?: { q?: string; choferId?: string; faltaChofer?: boolean }) => {
    // "custom" es la clave que entiende el listado (resolverRango); con otra
    // cosa cae al default de 3 meses y el link llevaría a otro período.
    const p = new URLSearchParams({ rango: "custom", desde: datos.desde, hasta: datos.hasta });
    if (extra?.q) p.set("q", extra.q);
    if (extra?.choferId) p.set("choferId", extra.choferId);
    // Los importados de la programación entran sin chofer: el listado los junta
    // con ?falta=chofer, que es la pantalla donde se les asigna.
    if (extra?.faltaChofer) p.set("falta", "chofer");
    return `/viajes?${p.toString()}`;
  };

  // Los filtros de texto se aplican acá y no en el server: los datos del rango
  // ya están, así que escribir filtra al instante.
  const destinos = useMemo(() => {
    const qd = normalizar(buscarDestino);
    const qc = normalizar(buscarChofer);
    return datos.destinos
      .filter((d) => !qd || normalizar(d.destino).includes(qd))
      .map((d) =>
        qc
          ? { ...d, choferes: d.choferes.filter((c) => normalizar(c.chofer).includes(qc)) }
          : d,
      )
      // Buscando un chofer, los destinos donde no fue no aportan nada.
      .filter((d) => !qc || d.choferes.length > 0);
  }, [datos.destinos, buscarDestino, buscarChofer]);

  const hayFiltro = buscarDestino.trim() !== "" || buscarChofer.trim() !== "";

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            {RANGOS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => elegirRango(r.id)}
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

          {/* Cualquier mes hacia atrás: el histórico ya está, faltaba pedirlo. */}
          {meses.length > 0 && (
            <select
              value={rango === "personalizado" ? mes : ""}
              onChange={(e) => e.target.value && elegirMes(e.target.value)}
              className={`h-8 rounded-lg border px-2 text-xs transition-colors ${
                rango === "personalizado"
                  ? "border-primary/50 bg-primary/5 font-medium text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
              aria-label="Elegir un mes"
            >
              <option value="">Otro mes…</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {labelMes(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarRange size={13} />
          {datos.desde === datos.hasta
            ? fmtFecha(datos.desde)
            : `${fmtFecha(datos.desde)} – ${fmtFecha(datos.hasta)}`}
          {pendiente && <span className="ml-1 text-primary">actualizando…</span>}
        </span>
      </div>

      {/* Búsquedas */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1">
          <MapPin
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
          />
          <input
            type="search"
            value={buscarDestino}
            onChange={(e) => setBuscarDestino(e.target.value)}
            placeholder="Buscar destino…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="relative min-w-[13rem] flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
          />
          <input
            type="search"
            value={buscarChofer}
            onChange={(e) => setBuscarChofer(e.target.value)}
            placeholder="Buscar chofer…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setBuscarDestino("");
              setBuscarChofer("");
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={12} /> Limpiar
          </button>
        )}
        <Link
          href={hrefListado()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Ver todos en el listado <ArrowUpRight size={12} className="text-primary" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Viajes" value={fmtNum(datos.totales.viajes)} />
        <Kpi label="Destinos" value={fmtNum(datos.totales.destinos)} />
        <Kpi label="Choferes" value={fmtNum(datos.totales.choferes)} />
        <Kpi label="KM" value={fmtNum(datos.totales.km)} />
        {datos.totales.sinChofer > 0 ? (
          <Link href={hrefListado({ faltaChofer: true })} title="Asignarles el chofer">
            <Kpi label="Sin chofer · asignar" value={fmtNum(datos.totales.sinChofer)} tone="warning" />
          </Link>
        ) : (
          <Kpi label="Sin chofer" value={fmtNum(datos.totales.sinChofer)} />
        )}
      </div>

      {destinos.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {hayFiltro
            ? "Ningún destino coincide con lo que buscaste."
            : "No hay viajes cargados en este período."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {destinos.map((d) => {
            const abierto = destinoAbierto === d.destino;
            return (
              <div key={d.destino} className="overflow-hidden rounded-[8px] border border-border bg-card">
                <div className="flex items-center gap-2 pr-3">
                  <button
                    type="button"
                    onClick={() => setDestinoAbierto(abierto ? null : d.destino)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {abierto ? (
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
                  <Link
                    href={hrefListado({ q: d.destino })}
                    title={`Ver los viajes a ${d.destino} en el listado`}
                    className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    <ArrowUpRight size={14} />
                  </Link>
                </div>

                {abierto && (
                  <div className="border-t border-border">
                    {d.choferes.length === 0 && d.sinChofer === 0 ? (
                      <p className="px-4 py-3 text-[13px] text-muted-foreground">
                        Sin choferes que coincidan con la búsqueda.
                      </p>
                    ) : null}

                    {d.choferes.map((c) => {
                      const clave = `${d.destino}|${c.chofer_id}`;
                      const verViajes = choferAbierto === clave;
                      return (
                        <div key={clave} className="border-b border-border/60 last:border-0">
                          <div className="flex items-center gap-2 pr-3">
                            <button
                              type="button"
                              onClick={() => setChoferAbierto(verViajes ? null : clave)}
                              className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {verViajes ? (
                                  <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                                )}
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
                                {c.toneladas > 0 && (
                                  <span className="tabular-nums">{fmtNum(c.toneladas, 1)} tn</span>
                                )}
                                {c.km > 0 && <span className="tabular-nums">{fmtNum(c.km)} km</span>}
                                <span className="tabular-nums">
                                  {c.viajes} viaje{c.viajes !== 1 ? "s" : ""}
                                </span>
                                <span>último el {fmtFecha(c.ultimo)}</span>
                              </span>
                            </button>
                            <Link
                              href={hrefListado({ choferId: c.chofer_id ?? undefined })}
                              title={`Ver los viajes de ${c.chofer} en el listado`}
                              className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            >
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                          {verViajes && (
                            <TablaViajes
                              viajes={c.detalle}
                              href={hrefListado({ choferId: c.chofer_id ?? undefined })}
                            />
                          )}
                        </div>
                      );
                    })}

                    {d.sinChofer > 0 && (
                      <div className="border-t border-[#B45309]/30 bg-[#B45309]/5">
                        <p className="px-4 py-2 text-[12px] font-medium text-[#B45309]">
                          {d.sinChofer} viaje{d.sinChofer !== 1 ? "s" : ""} sin chofer asignado
                        </p>
                        <TablaViajes
                          viajes={d.sinChoferDetalle}
                          href={hrefListado({ q: d.destino, faltaChofer: true })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
