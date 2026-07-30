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
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  Gauge,
  Loader2,
  MapPin,
  Pencil,
  Route as RouteIcon,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import AvatarPersona from "@/components/ui/AvatarPersona";
import MarcaLogo from "../../camiones/components/MarcaLogo";
import { actualizarViajeHojaRutaAction } from "../hoja-ruta/actions";
import {
  asignarChoferViajeAction,
  getChoferesParaAsignarAction,
  getMesesConViajesAction,
  getResumenDestinosAction,
  type ChoferParaAsignar,
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

/**
 * Una cifra del período.
 *
 * Antes era una etiqueta en mayúsculas gritadas y un número suelto, todas
 * iguales: había que leer las cinco para entender cuál era cuál. Ahora cada una
 * tiene su ícono, la unidad al lado del número (no metida en el título) y una
 * línea de contexto abajo — y la que se puede accionar se ve accionable.
 */
function Metrica({
  label,
  valor,
  unidad,
  icono: Icono,
  pie,
  tono,
  href,
}: {
  label: string;
  valor: string;
  unidad?: string;
  icono: LucideIcon;
  pie?: string;
  tono?: "warning";
  href?: string;
}) {
  const cuerpo = (
    <>
      <span className="flex items-center gap-1.5">
        <Icono
          size={13}
          className={tono === "warning" ? "text-[#B45309]" : "text-muted-foreground/70"}
        />
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-[26px] font-semibold leading-none tracking-tight tabular-nums ${
            tono === "warning" ? "text-[#B45309]" : "text-foreground"
          }`}
        >
          {valor}
        </span>
        {unidad && <span className="text-[12px] text-muted-foreground">{unidad}</span>}
      </span>
      <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">
        {pie ?? "\u00a0"}
      </span>
    </>
  );

  const base = "block rounded-[8px] border bg-card px-4 py-3.5 transition-colors";
  if (!href) {
    return <div className={`${base} border-border`}>{cuerpo}</div>;
  }
  return (
    <Link
      href={href}
      className={`${base} group border-[#B45309]/40 hover:border-[#B45309] hover:bg-[#B45309]/[0.04]`}
    >
      {cuerpo}
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#B45309]">
        Asignarles chofer
        <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Lo que se puede corregir de un viaje sin salir de acá. */
type Borrador = { origen: string; remito: string; km: string; toneladas: string; monto: string };

const borradorDe = (v: ViajeDelResumen): Borrador => ({
  origen: v.origen ?? "",
  remito: v.remito ?? "",
  km: v.km ? String(v.km) : "",
  toneladas: v.toneladas != null ? String(v.toneladas) : "",
  monto: v.monto != null ? String(v.monto) : "",
});

const numero = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Sólo los campos que cambiaron.
 *
 * Mandar los siete siempre reescribía el importe con el valor que estaba en
 * pantalla al abrir: corregir un remito podía pisar una certificación. Si no se
 * tocó, no viaja.
 */
function cambiosDe(v: ViajeDelResumen, b: Borrador) {
  const o = borradorDe(v);
  const c: Parameters<typeof actualizarViajeHojaRutaAction>[1] = {};
  if (b.origen.trim() !== o.origen.trim()) c.origen_nombre = b.origen.trim() || null;
  if (b.remito.trim() !== o.remito.trim()) c.nro_remito = b.remito.trim() || null;
  // km_con_carga es NOT NULL en la base: vaciar la celda es cero, no nulo.
  if (b.km.trim() !== o.km.trim()) c.km_con_carga = numero(b.km) ?? 0;
  if (b.toneladas.trim() !== o.toneladas.trim()) c.tonelaje_real = numero(b.toneladas);
  if (b.monto.trim() !== o.monto.trim()) c.monto_flete = numero(b.monto);
  return c;
}

const CELDA_INPUT =
  "h-7 w-full rounded-[4px] border border-border bg-card px-1.5 text-[12px] text-foreground outline-none focus:border-primary";

/** Una fila del detalle: se lee, y con el lápiz se edita en el lugar. */
function FilaViaje({
  viaje,
  canWrite,
  choferes,
  pidiendoChoferes,
  onPedirChoferes,
  onGuardado,
}: {
  viaje: ViajeDelResumen;
  canWrite: boolean;
  choferes: ChoferParaAsignar[] | undefined;
  pidiendoChoferes: boolean;
  onPedirChoferes: (fecha: string) => void;
  onGuardado: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [b, setB] = useState<Borrador>(() => borradorDe(viaje));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choferId, setChoferId] = useState("");

  const abrir = () => {
    setB(borradorDe(viaje));
    setError(null);
    setEditando(true);
  };

  const guardar = async () => {
    const cambios = cambiosDe(viaje, b);
    if (Object.keys(cambios).length === 0) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    setError(null);
    const res = await actualizarViajeHojaRutaAction(viaje.id, cambios);
    setGuardando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEditando(false);
    onGuardado();
  };

  const asignar = async (id: string) => {
    setChoferId(id);
    if (!id) return;
    setGuardando(true);
    setError(null);
    const res = await asignarChoferViajeAction(viaje.id, id);
    setGuardando(false);
    if ("error" in res) {
      setError(res.error);
      setChoferId("");
      return;
    }
    onGuardado();
  };

  const sinChofer = viaje.sinChofer;

  if (editando) {
    return (
      <>
        <tr className="bg-primary/[0.04] align-middle">
          <td className="py-1.5 pr-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
            {fmtFecha(viaje.fecha)}
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.origen}
              onChange={(e) => setB({ ...b, origen: e.target.value })}
              placeholder="desde"
              className={CELDA_INPUT}
            />
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.remito}
              onChange={(e) => setB({ ...b, remito: e.target.value })}
              placeholder="remito"
              className={`${CELDA_INPUT} font-mono`}
            />
          </td>
          <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
            {viaje.material ?? viaje.cliente ?? "—"}
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.km}
              onChange={(e) => setB({ ...b, km: e.target.value })}
              inputMode="decimal"
              className={`${CELDA_INPUT} text-right tabular-nums`}
            />
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.toneladas}
              onChange={(e) => setB({ ...b, toneladas: e.target.value })}
              inputMode="decimal"
              className={`${CELDA_INPUT} text-right tabular-nums`}
            />
          </td>
          <td className="py-1.5 pl-2">
            <input
              value={b.monto}
              onChange={(e) => setB({ ...b, monto: e.target.value })}
              inputMode="decimal"
              className={`${CELDA_INPUT} text-right tabular-nums`}
            />
          </td>
          <td className="py-1.5 pl-2">
            <span className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                title="Guardar"
                className="rounded-[4px] border border-primary/50 p-1 text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                disabled={guardando}
                title="Cancelar"
                className="rounded-[4px] border border-border p-1 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X size={12} />
              </button>
            </span>
          </td>
        </tr>
        {error && (
          <tr>
            <td colSpan={8} className="pb-1.5 pl-2 text-[11px] text-[#B91C1C]">
              {error}
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr className="text-foreground">
        <td className="py-1.5 pr-3 font-mono text-[11px] whitespace-nowrap">
          {fmtFecha(viaje.fecha)}
        </td>
        <td className="px-2 py-1.5">{viaje.origen ?? "—"}</td>
        <td className="px-2 py-1.5 font-mono text-[11px]">{viaje.remito ?? "—"}</td>
        <td className="max-w-[16rem] truncate px-2 py-1.5 text-muted-foreground">
          {viaje.material ?? viaje.cliente ?? "—"}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">{fmtNum(viaje.km)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          {viaje.toneladas ? fmtNum(viaje.toneladas, 1) : "—"}
        </td>
        <td className="py-1.5 pl-2 text-right tabular-nums">
          {viaje.monto != null ? (
            ars(viaje.monto)
          ) : (
            <span className="text-[#B45309]">sin importe</span>
          )}
        </td>
        <td className="py-1.5 pl-2 text-right">
          {canWrite && (
            <button
              type="button"
              onClick={abrir}
              title="Corregir este viaje"
              className="rounded-[4px] border border-border p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              <Pencil size={12} />
            </button>
          )}
        </td>
      </tr>

      {/* Ponerle el chofer: el paso que el Excel de Loma no trae. */}
      {sinChofer && canWrite && (
        <tr>
          <td colSpan={8} className="pb-2 pl-2">
            {choferes ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Va con:</span>
                <Combobox
                  options={choferes.map((c) => ({
                    id: c.id,
                    label: c.nombre,
                    note: c.patente ?? undefined,
                  }))}
                  value={choferId}
                  onValueChange={asignar}
                  placeholder="elegir chofer…"
                  searchPlaceholder="Buscar chofer…"
                  disabled={guardando}
                  triggerClassName="h-7 text-[12px]"
                  className="min-w-[15rem]"
                  aria-label="Asignarle un chofer a este viaje"
                />
                {guardando && <Loader2 size={12} className="animate-spin text-primary" />}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onPedirChoferes(viaje.fecha)}
                disabled={pidiendoChoferes}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#B45309]/40 px-2 py-1 text-[11px] font-medium text-[#B45309] transition-colors hover:bg-[#B45309]/10 disabled:opacity-60"
              >
                {pidiendoChoferes ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <UserRound size={11} />
                )}
                Asignarle un chofer
              </button>
            )}
            {error && <span className="ml-2 text-[11px] text-[#B91C1C]">{error}</span>}
          </td>
        </tr>
      )}
    </>
  );
}

/** Los viajes de un chofer a ese destino: lo que antes había que ir a buscar. */
function TablaViajes({
  viajes,
  href,
  canWrite,
  choferesPorFecha,
  pidiendoFecha,
  onPedirChoferes,
  onGuardado,
}: {
  viajes: ViajeDelResumen[];
  href: string;
  canWrite: boolean;
  choferesPorFecha: Record<string, ChoferParaAsignar[]>;
  pidiendoFecha: string | null;
  onPedirChoferes: (fecha: string) => void;
  onGuardado: () => void;
}) {
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
            <th className="py-1 pl-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {viajes.map((v) => (
            <FilaViaje
              key={v.id}
              viaje={v}
              canWrite={canWrite}
              choferes={choferesPorFecha[v.fecha]}
              pidiendoChoferes={pidiendoFecha === v.fecha}
              onPedirChoferes={onPedirChoferes}
              onGuardado={onGuardado}
            />
          ))}
        </tbody>
      </table>
      <Link
        href={href}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Abrir en el listado <ArrowUpRight size={11} />
      </Link>
    </div>
  );
}

export default function ResumenDestinosClient({
  inicial,
  hoy,
  canWrite,
}: {
  inicial: ResumenDestinos;
  hoy: string;
  canWrite: boolean;
}) {
  const [datos, setDatos] = useState(inicial);
  const [rango, setRango] = useState<RangoId>("hoy");
  const [mes, setMes] = useState<string>(hoy.slice(0, 7));
  const [meses, setMeses] = useState<string[]>([]);
  const [buscarDestino, setBuscarDestino] = useState("");
  const [buscarChofer, setBuscarChofer] = useState("");
  const [destinoAbierto, setDestinoAbierto] = useState<string | null>(null);
  const [choferAbierto, setChoferAbierto] = useState<string | null>(null);
  // La lista de choferes se pide por fecha (el camión de cada uno depende de la
  // planilla de ese día) y sólo cuando alguien va a asignar.
  const [choferesPorFecha, setChoferesPorFecha] = useState<Record<string, ChoferParaAsignar[]>>({});
  const [pidiendoFecha, setPidiendoFecha] = useState<string | null>(null);
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

  /** Releer el rango que está en pantalla, después de editar algo. */
  const recargar = () => cargar(datos.desde, datos.hasta);

  const pedirChoferes = async (fecha: string) => {
    if (choferesPorFecha[fecha]) return;
    setPidiendoFecha(fecha);
    try {
      const lista = await getChoferesParaAsignarAction(fecha);
      setChoferesPorFecha((prev) => ({ ...prev, [fecha]: lista }));
    } finally {
      setPidiendoFecha(null);
    }
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
            <Combobox
              options={meses.map((m) => ({ id: m, label: labelMes(m) }))}
              value={rango === "personalizado" ? mes : ""}
              onValueChange={(v) => v && elegirMes(v)}
              placeholder="Otro mes…"
              searchPlaceholder="Buscar mes…"
              aria-label="Elegir un mes"
              className="w-[11rem]"
              triggerClassName={
                rango === "personalizado"
                  ? "h-8 border-primary/50 bg-primary/5 text-xs font-medium text-primary"
                  : "h-8 text-xs"
              }
            />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metrica
          label="Viajes"
          valor={fmtNum(datos.totales.viajes)}
          icono={RouteIcon}
          pie={
            datos.totales.viajes === 0
              ? "nada cargado todavía"
              : `${fmtNum(datos.totales.viajes / Math.max(datos.totales.destinos, 1), 1)} por destino`
          }
        />
        <Metrica
          label="Destinos"
          valor={fmtNum(datos.totales.destinos)}
          icono={MapPin}
          pie={destinos[0] ? `más movimiento: ${destinos[0].destino}` : undefined}
        />
        <Metrica
          label="Choferes"
          valor={fmtNum(datos.totales.choferes)}
          icono={Users}
          pie={
            datos.totales.choferes > 0
              ? `${fmtNum(datos.totales.viajes / datos.totales.choferes, 1)} viajes cada uno`
              : undefined
          }
        />
        <Metrica
          label="Recorrido"
          valor={fmtNum(datos.totales.km)}
          unidad="km"
          icono={Gauge}
          pie={
            datos.totales.viajes > 0
              ? `${fmtNum(datos.totales.km / datos.totales.viajes)} km por viaje`
              : undefined
          }
        />
        <Metrica
          label="Sin chofer"
          valor={fmtNum(datos.totales.sinChofer)}
          icono={UserRound}
          tono={datos.totales.sinChofer > 0 ? "warning" : undefined}
          pie={datos.totales.sinChofer === 0 ? "todos asignados" : "esperando quién los haga"}
          href={datos.totales.sinChofer > 0 ? hrefListado({ faltaChofer: true }) : undefined}
        />
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
                      <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                        {d.destino}
                      </span>
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
                      {/* El número solo no decía de qué era. */}
                      <span className="flex items-baseline gap-1">
                        <span className="text-[17px] font-semibold leading-none tracking-tight text-foreground">
                          {d.viajes}
                        </span>
                        <span className="text-[11px]">viaje{d.viajes !== 1 ? "s" : ""}</span>
                      </span>
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
                                {/* La cara y la marca se reconocen de un vistazo;
                                    el ícono genérico repetido no distinguía nada. */}
                                <AvatarPersona
                                  name={c.chofer}
                                  rol={c.rol}
                                  src={c.fotoUrl}
                                  size={26}
                                />
                                <span className="truncate text-[13px] font-medium text-foreground">
                                  {c.chofer}
                                </span>
                                {c.camion && (
                                  <span className="inline-flex shrink-0 items-center gap-1.5">
                                    <MarcaLogo
                                      marca={c.camionMarca}
                                      patente={c.camion}
                                      size={22}
                                    />
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      {c.camion}
                                    </span>
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
                              canWrite={canWrite}
                              choferesPorFecha={choferesPorFecha}
                              pidiendoFecha={pidiendoFecha}
                              onPedirChoferes={pedirChoferes}
                              onGuardado={recargar}
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
                          canWrite={canWrite}
                          choferesPorFecha={choferesPorFecha}
                          pidiendoFecha={pidiendoFecha}
                          onPedirChoferes={pedirChoferes}
                          onGuardado={recargar}
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
