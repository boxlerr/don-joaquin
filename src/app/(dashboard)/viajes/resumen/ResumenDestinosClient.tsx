"use client";

/**
 * Entrar por destino en vez de por chofer.
 *
 * Nico: "hoy paso tres viajes a Lomaser, dos a Escobar; para no tener que
 * entrar chofer por chofer para ver a dónde fue el último viaje que le di".
 *
 * Cada chofer aparece UNA sola vez, en el lugar donde terminó su último viaje.
 * Antes salía en todos los destinos a los que había ido —Mehring en Lomaser y en
 * Ramallo— y para decidir a quién darle el próximo viaje eso es ruido.
 *
 * Tres niveles: lugar → choferes que quedaron ahí → sus viajes del período, con
 * fecha, de dónde salió, remito, km e importe. Todo acá, sin saltar de pantalla.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Gauge,
  IdCard,
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
import CalendarioPopover from "@/components/ui/CalendarioPopover";
import AvatarPersona from "@/components/ui/AvatarPersona";
import MarcaLogo from "../../camiones/components/MarcaLogo";
import { actualizarViajeHojaRutaAction } from "../hoja-ruta/actions";
import { descargarXlsxBase64 } from "@/lib/excel/download-client";
import HelpTutorialButton from "./help-tutorial-button";
import { exportarResumenDestinosAction } from "./export-action";
import { filtrarDestinos } from "./filtros";
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

/**
 * Una cifra del período.
 *
 * Cada una tiene su color en el ícono y en el número, así se distinguen de un
 * vistazo en vez de leerse como cinco párrafos iguales. El color va sólo en el
 * ícono y el número — nada de fondos de color, que ensucian la lectura.
 */
function Metrica({
  label,
  valor,
  unidad,
  icono: Icono,
  pie,
  color,
  href,
  accion,
}: {
  label: string;
  valor: string;
  unidad?: string;
  icono: LucideIcon;
  pie?: string;
  /** Color del ícono y del número. */
  color: string;
  href?: string;
  /** Texto del link, cuando la tarjeta lleva a algún lado. */
  accion?: string;
}) {
  const cuerpo = (
    <>
      <span className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border"
          style={{ borderColor: `${color}3D`, backgroundColor: `${color}14`, color }}
        >
          <Icono size={15} />
        </span>
        <span className="text-[12.5px] font-bold uppercase tracking-wide text-foreground/75">
          {label}
        </span>
      </span>
      <span className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className="text-[32px] font-bold leading-none tracking-tight tabular-nums"
          style={{ color }}
        >
          {valor}
        </span>
        {unidad && (
          <span className="text-[13px] font-bold text-muted-foreground">{unidad}</span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-[11.5px] font-semibold text-muted-foreground">
        {pie ?? "\u00a0"}
      </span>
    </>
  );

  const base =
    "block rounded-[8px] border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all";
  if (!href) {
    return <div className={`${base} border-border`}>{cuerpo}</div>;
  }
  return (
    <Link
      href={href}
      className={`${base} group border-border hover:-translate-y-px hover:shadow-md`}
      style={{ borderColor: `${color}59` }}
    >
      {cuerpo}
      <span
        className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-bold"
        style={{ color }}
      >
        {accion}
        <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Lo que se puede corregir de un viaje sin salir de acá. */
type Borrador = {
  origen: string;
  remito: string;
  material: string;
  km: string;
  toneladas: string;
  monto: string;
};

const borradorDe = (v: ViajeDelResumen): Borrador => ({
  origen: v.origen ?? "",
  remito: v.remito ?? "",
  material: v.material ?? "",
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
  if (b.material.trim() !== o.material.trim()) c.material = b.material.trim() || null;
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
  hrefViaje,
  onPedirChoferes,
  onGuardado,
}: {
  viaje: ViajeDelResumen;
  canWrite: boolean;
  choferes: ChoferParaAsignar[] | undefined;
  pidiendoChoferes: boolean;
  /** El listado abierto en ESTE viaje. */
  hrefViaje: string;
  onPedirChoferes: (fecha: string) => void;
  onGuardado: () => void;
}) {
  const router = useRouter();
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
          <td className="px-2 py-1.5 text-[12px] font-medium text-muted-foreground">
            {viaje.destino}
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.remito}
              onChange={(e) => setB({ ...b, remito: e.target.value })}
              placeholder="remito"
              className={`${CELDA_INPUT} font-mono`}
            />
          </td>
          <td className="px-2 py-1.5">
            <input
              value={b.material}
              onChange={(e) => setB({ ...b, material: e.target.value })}
              placeholder="qué llevaba"
              className={CELDA_INPUT}
            />
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
            <td colSpan={9} className="pb-1.5 pl-2 text-[11px] text-[#B91C1C]">
              {error}
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      {/* Toda la fila abre ese viaje en el listado; el lápiz no, que edita acá. */}
      <tr
        className="group cursor-pointer text-foreground transition-colors hover:bg-card"
        tabIndex={0}
        onClick={() => router.push(hrefViaje)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(hrefViaje);
        }}
        title="Abrir este viaje en el listado"
      >
        <td className="py-2 pl-3 pr-3 font-mono text-[11.5px] font-semibold whitespace-nowrap text-foreground">
          {fmtFecha(viaje.fecha)}
        </td>
        <td className="px-2 py-2 font-medium">{viaje.origen ?? "—"}</td>
        <td className="px-2 py-2 font-semibold text-foreground">{viaje.destino}</td>
        <td className="px-2 py-2 font-mono text-[11.5px] font-semibold">
          {viaje.remito ?? <span className="font-sans font-normal text-muted-foreground/60">—</span>}
        </td>
        <td className="max-w-[16rem] px-2 py-2">
          {/* El material es el material. Antes, cuando estaba vacío, se mostraba
              el cliente en su lugar y parecía que el viaje llevaba "LOMA NEGRA
              CIASA". */}
          {viaje.material ? (
            <span className="block truncate font-semibold text-foreground">{viaje.material}</span>
          ) : (
            <span className="font-medium text-muted-foreground/60">sin cargar</span>
          )}
          {viaje.cliente && (
            <span className="block truncate text-[10.5px] text-muted-foreground">
              {viaje.cliente}
            </span>
          )}
        </td>
        <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtNum(viaje.km)}</td>
        <td className="px-2 py-2 text-right font-semibold tabular-nums">
          {viaje.toneladas ? (
            fmtNum(viaje.toneladas, 1)
          ) : (
            <span className="font-normal text-muted-foreground/60">—</span>
          )}
        </td>
        <td className="py-2 pl-2 text-right tabular-nums">
          {viaje.monto != null && viaje.monto > 0 ? (
            <span className="font-bold text-foreground">{ars(viaje.monto)}</span>
          ) : (
            <span className="font-semibold text-[#B45309]">sin importe</span>
          )}
        </td>
        <td className="py-2 pl-2 pr-3 text-right whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <ArrowUpRight
              size={12}
              className="text-muted-foreground/0 transition-colors group-hover:text-primary"
            />
            {canWrite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  abrir();
                }}
                title="Corregir este viaje acá"
                className="rounded-[4px] border border-border p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                <Pencil size={12} />
              </button>
            )}
          </span>
        </td>
      </tr>

      {/* Ponerle el chofer: el paso que el Excel de Loma no trae. */}
      {sinChofer && canWrite && (
        <tr>
          <td colSpan={9} className="pb-2 pl-2">
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
  hrefDeViaje,
  canWrite,
  choferesPorFecha,
  pidiendoFecha,
  onPedirChoferes,
  onGuardado,
}: {
  viajes: ViajeDelResumen[];
  /** El listado con TODOS estos viajes filtrados. */
  href: string;
  /** El listado abierto en un viaje puntual. */
  hrefDeViaje: (v: ViajeDelResumen) => string;
  canWrite: boolean;
  choferesPorFecha: Record<string, ChoferParaAsignar[]>;
  pidiendoFecha: string | null;
  onPedirChoferes: (fecha: string) => void;
  onGuardado: () => void;
}) {
  return (
    <div className="border-t border-border bg-muted/30 px-4 pb-3 pt-2">
      <div className="overflow-hidden rounded-[6px] border border-border bg-card">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-y border-border bg-muted text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-3 pr-3 text-left font-bold">Fecha</th>
            <th className="px-2 py-2 text-left font-bold">Desde</th>
            <th className="px-2 py-2 text-left font-bold">Hasta</th>
            <th className="px-2 py-2 text-left font-bold">Remito</th>
            <th className="px-2 py-2 text-left font-bold">Material</th>
            <th className="px-2 py-2 text-right font-bold">KM</th>
            <th className="px-2 py-2 text-right font-bold">Tn</th>
            <th className="py-2 pl-2 text-right font-bold">Importe</th>
            <th className="py-2 pl-2 pr-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {viajes.map((v) => (
            <FilaViaje
              key={v.id}
              viaje={v}
              canWrite={canWrite}
              choferes={choferesPorFecha[v.fecha]}
              pidiendoChoferes={pidiendoFecha === v.fecha}
              hrefViaje={hrefDeViaje(v)}
              onPedirChoferes={onPedirChoferes}
              onGuardado={onGuardado}
            />
          ))}
        </tbody>
      </table>
      </div>
      <Link
        href={href}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/50 hover:text-primary"
      >
        Ver {viajes.length === 1 ? "este viaje" : `estos ${viajes.length} viajes`} en el listado
        <ArrowUpRight size={11} className="text-primary" />
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
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);
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

  const exportar = async () => {
    setExportando(true);
    setErrorExport(null);
    const res = await exportarResumenDestinosAction(datos.desde, datos.hasta, {
      destino: buscarDestino,
      chofer: buscarChofer,
    });
    setExportando(false);
    if ("error" in res) {
      setErrorExport(res.error);
      return;
    }
    descargarXlsxBase64(res.filename, res.base64);
  };

  const elegirRango = (id: Exclude<RangoId, "personalizado">) => {
    setRango(id);
    const { desde, hasta } = rangoDe(id, hoy);
    cargar(desde, hasta);
  };

  /**
   * Un día puntual desde el calendario.
   *
   * Si cae en hoy o ayer se marca el botón que le corresponde: elegir el 29 en
   * el calendario y que "Ayer" quedara apagado se lee como si fueran dos cosas
   * distintas.
   */
  const elegirDia = (fecha: string) => {
    const ayer = rangoDe("ayer", hoy).desde;
    setRango(fecha === hoy ? "hoy" : fecha === ayer ? "ayer" : "personalizado");
    cargar(fecha, fecha);
  };

  const elegirMes = (m: string) => {
    setMes(m);
    setRango("personalizado");
    const { desde, hasta } = rangoDelMes(m);
    cargar(desde, hasta);
  };

  /** El listado con las mismas fechas y, si hace falta, el destino ya buscado. */
  const hrefListado = (extra?: {
    destino?: string;
    choferId?: string;
    faltaChofer?: boolean;
    viajeId?: string;
  }) => {
    // "custom" es la clave que entiende el listado (resolverRango); con otra
    // cosa cae al default de 3 meses y el link llevaría a otro período.
    const p = new URLSearchParams({ rango: "custom", desde: datos.desde, hasta: datos.hasta });
    // Por destino exacto, no por el buscador libre: éste traería también los
    // viajes que SALIERON de ese lugar, y acá se agrupa por a dónde fueron.
    if (extra?.destino) {
      p.set("destino", extra.destino);
      // El resumen no cuenta los retornos vacíos, así que el listado tampoco:
      // si no, el link mostraba 8 viajes donde acá dice 4.
      p.set("sinVacios", "1");
    }
    if (extra?.choferId) p.set("choferId", extra.choferId);
    // Los importados de la programación entran sin chofer: el listado los junta
    // con ?falta=chofer, que es la pantalla donde se les asigna.
    if (extra?.faltaChofer) p.set("falta", "chofer");
    // El listado abre esa fila desplegada y hace scroll hasta ella.
    if (extra?.viajeId) p.set("viaje", extra.viajeId);
    return `/viajes?${p.toString()}`;
  };

  // Los filtros de texto se aplican acá y no en el server: los datos del rango
  // ya están, así que escribir filtra al instante.
  // El mismo filtrado que usa el export, para que el Excel no pueda traer algo
  // distinto de lo que hay en pantalla.
  const destinos = useMemo(
    () => filtrarDestinos(datos.destinos, { destino: buscarDestino, chofer: buscarChofer }),
    [datos.destinos, buscarDestino, buscarChofer],
  );

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
                className={`rounded-[5px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  rango === r.id
                    ? "border border-border bg-card text-foreground shadow-sm"
                    : "border border-transparent text-muted-foreground hover:text-foreground"
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
              triggerClassName={
                // El ancho va acá: el Root de base-ui no pinta nada, así que un
                // className afuera no lo limitaba y el selector se comía la fila.
                rango === "personalizado"
                  ? "h-9 w-[11.5rem] rounded-[6px] border-primary/50 bg-primary/5 text-[12.5px] font-semibold text-primary"
                  : "h-9 w-[11.5rem] rounded-[6px] text-[12.5px] font-medium"
              }
            />
          )}
        </div>

        {/* La fecha era un cartel: se leía como un dato y no se notaba que se
            podía elegir el día. Ahora abre el calendario. */}
        <span className="inline-flex items-center gap-2">
          {pendiente && <span className="text-[12px] font-medium text-primary">actualizando…</span>}
          <CalendarioPopover
            value={datos.desde === datos.hasta ? datos.desde : null}
            onSelect={elegirDia}
            maxDate={hoy}
            hoy={hoy}
            ariaLabel="Elegir el día que se mira"
            triggerClassName="h-9 rounded-[6px] border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-primary/50 hover:text-primary"
            triggerLabel={
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange size={13} className="text-primary" />
                {datos.desde === datos.hasta
                  ? fmtFecha(datos.desde)
                  : `${fmtFecha(datos.desde)} – ${fmtFecha(datos.hasta)}`}
                <ChevronDown size={12} className="text-muted-foreground" />
              </span>
            }
          />
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
            className="h-10 w-full rounded-[6px] border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none placeholder:font-normal focus:border-primary"
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
            className="h-10 w-full rounded-[6px] border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none placeholder:font-normal focus:border-primary"
          />
        </div>
        {hayFiltro && (
          <button
            type="button"
            onClick={() => {
              setBuscarDestino("");
              setBuscarChofer("");
            }}
            className="inline-flex h-10 items-center gap-1 rounded-[6px] border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={12} /> Limpiar
          </button>
        )}
        <Link
          href={hrefListado()}
          className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/50 hover:text-primary"
        >
          Ver todos en el listado <ArrowUpRight size={12} className="text-primary" />
        </Link>
        <button
          type="button"
          onClick={exportar}
          disabled={exportando || datos.totales.viajes === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          {exportando ? (
            <Loader2 size={13} className="animate-spin text-primary" />
          ) : (
            <Download size={13} className="text-primary" />
          )}
          {exportando ? "Armando…" : "Exportar"}
        </button>
        <HelpTutorialButton triggerClassName="h-10 rounded-[6px] border border-border bg-card px-3.5 text-xs font-semibold text-primary shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-muted inline-flex items-center gap-1.5 [&_svg]:size-3.5" />
      </div>

      {errorExport && (
        <p className="flex items-start gap-2 border-l-2 border-[#B91C1C] pl-3 text-sm font-medium text-[#B91C1C]">
          {errorExport}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metrica
          label="Viajes"
          valor={fmtNum(datos.totales.viajes)}
          icono={RouteIcon}
          color="#0088D1"
          pie={
            datos.totales.viajes === 0
              ? "todavía no se cargó ninguno"
              : `${fmtNum(datos.totales.viajes / Math.max(datos.totales.destinos, 1), 1)} por lugar`
          }
        />
        <Metrica
          label="Lugares"
          valor={fmtNum(datos.totales.destinos)}
          icono={MapPin}
          color="#7C3AED"
          pie={
            destinos[0]
              ? `donde más hay: ${destinos[0].destino}`
              : "sin movimiento en el período"
          }
        />
        <Metrica
          label="Choferes"
          valor={fmtNum(datos.totales.choferes)}
          icono={Users}
          color="#0D9488"
          pie={
            datos.totales.choferes > 0
              ? `${fmtNum(datos.totales.viajes / datos.totales.choferes, 1)} viajes cada uno`
              : "nadie salió en el período"
          }
        />
        <Metrica
          label="Recorrido"
          valor={fmtNum(datos.totales.km)}
          unidad="km"
          icono={Gauge}
          color="#4F46E5"
          pie={
            datos.totales.viajes > 0
              ? `${fmtNum(datos.totales.km / datos.totales.viajes)} km por viaje`
              : "sin kilómetros cargados"
          }
        />
        <Metrica
          label="Sin chofer"
          valor={fmtNum(datos.totales.sinChofer)}
          icono={UserRound}
          color={datos.totales.sinChofer > 0 ? "#B45309" : "#059669"}
          pie={
            datos.totales.sinChofer === 0
              ? "todos tienen quién los haga"
              : "falta decidir quién los hace"
          }
          href={datos.totales.sinChofer > 0 ? hrefListado({ faltaChofer: true }) : undefined}
          accion="Asignarles chofer"
        />
      </div>

      {destinos.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-border bg-muted/30 py-14 text-center text-sm font-medium text-muted-foreground">
          {hayFiltro
            ? "Ningún lugar coincide con lo que buscaste."
            : "No hay viajes cargados en este período, así que no hay dónde ubicar a nadie."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {destinos.map((d) => {
            const abierto = destinoAbierto === d.destino;
            return (
              <div
                key={d.destino}
                className={`overflow-hidden rounded-[8px] border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-shadow ${
                  abierto ? "border-primary/40 shadow-md" : "border-border hover:shadow-md"
                }`}
              >
                <div
                  className={`flex items-center gap-2 pr-3 ${abierto ? "bg-muted" : "bg-card"}`}
                >
                  <button
                    type="button"
                    onClick={() => setDestinoAbierto(abierto ? null : d.destino)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {abierto ? (
                        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted text-primary">
                        <MapPin size={14} />
                      </span>
                      <span className="truncate text-[16px] font-bold tracking-tight text-foreground">
                        {d.destino}
                      </span>
                      {d.choferes.length > 0 && (
                        <span className="shrink-0 rounded-[4px] border border-[#059669]/40 bg-[#059669]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                          {d.choferes.length} {d.choferes.length !== 1 ? "quedaron" : "quedó"} acá
                        </span>
                      )}
                      {d.sinChofer > 0 && (
                        <span className="shrink-0 rounded-[4px] border border-[#B45309]/40 px-1.5 py-0.5 text-[11px] font-medium text-[#B45309]">
                          {d.sinChofer} sin asignar
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-4 text-[12.5px] tabular-nums text-muted-foreground">
                      {d.toneladas > 0 && (
                        <span>
                          <b className="font-semibold text-foreground">{fmtNum(d.toneladas, 1)}</b> tn
                        </span>
                      )}
                      {d.km > 0 && (
                        <span>
                          <b className="font-semibold text-foreground">{fmtNum(d.km)}</b> km
                        </span>
                      )}
                      {d.ultimaLlegada && (
                        <span className="whitespace-nowrap">
                          última llegada{" "}
                          <b className="font-semibold text-foreground">
                            {fmtFecha(d.ultimaLlegada)}
                          </b>
                        </span>
                      )}
                      {/* Lo que importa acá es cuánta gente hay parada. */}
                      <span className="flex items-baseline gap-1">
                        <span className="text-[20px] font-bold leading-none tracking-tight text-primary">
                          {d.choferes.length}
                        </span>
                        <span className="text-[11.5px] font-medium">
                          chofer{d.choferes.length !== 1 ? "es" : ""}
                        </span>
                      </span>
                    </span>
                  </button>
                  <Link
                    href={hrefListado({ destino: d.destino })}
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
                        Ningún chofer coincide con la búsqueda.
                      </p>
                    ) : null}

                    {d.choferes.map((c) => {
                      const clave = `${d.destino}|${c.chofer_id}`;
                      const verViajes = choferAbierto === clave;
                      return (
                        <div key={clave} className="border-b border-border last:border-0">
                          <div
                            className={`flex items-center gap-2 pr-3 ${verViajes ? "bg-muted/60" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => setChoferAbierto(verViajes ? null : clave)}
                              className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
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
                                <span className="truncate text-[14px] font-semibold text-foreground">
                                  {c.chofer}
                                </span>
                                {c.camion && (
                                  <span className="inline-flex shrink-0 items-center gap-1.5">
                                    <MarcaLogo
                                      marca={c.camionMarca}
                                      patente={c.camion}
                                      size={22}
                                    />
                                    <span className="font-mono text-[11.5px] font-semibold text-muted-foreground">
                                      {c.camion}
                                    </span>
                                  </span>
                                )}
                              </span>
                              <span className="flex shrink-0 items-center gap-4 text-[12.5px] text-muted-foreground">
                                {c.toneladas > 0 && (
                                  <span className="tabular-nums">
                                    <b className="font-semibold text-foreground">
                                      {fmtNum(c.toneladas, 1)}
                                    </b>{" "}
                                    tn
                                  </span>
                                )}
                                {c.km > 0 && (
                                  <span className="tabular-nums">
                                    <b className="font-semibold text-foreground">{fmtNum(c.km)}</b> km
                                  </span>
                                )}
                                <span className="tabular-nums">
                                  <b className="font-semibold text-foreground">{c.viajes}</b> viaje
                                  {c.viajes !== 1 ? "s" : ""}
                                </span>
                                {/* El tramo con el que llegó: "fue a Lomaser
                                    después de Ramallo, y ahí quedó". */}
                                {c.vinoDe && (
                                  <span className="whitespace-nowrap">
                                    vino de{" "}
                                    <b className="font-semibold text-foreground">{c.vinoDe}</b>
                                  </span>
                                )}
                                <span className="whitespace-nowrap">
                                  llegó el{" "}
                                  <b className="font-semibold text-foreground">
                                    {fmtFecha(c.llegoEl)}
                                  </b>
                                </span>
                              </span>
                            </button>
                            {/* El avatar y el nombre son de una persona con
                                legajo: desde acá se llega a él. */}
                            {c.chofer_id && (
                              <Link
                                href={`/choferes/${c.chofer_id}`}
                                title={`Abrir el legajo de ${c.chofer}`}
                                className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                              >
                                <IdCard size={14} />
                              </Link>
                            )}
                            <Link
                              href={hrefListado({
                                destino: d.destino,
                                choferId: c.chofer_id ?? undefined,
                              })}
                              title={`Ver en el listado los viajes de ${c.chofer} a ${d.destino}`}
                              className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            >
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                          {verViajes && (
                            <TablaViajes
                              viajes={c.detalle}
                              href={hrefListado({
                                destino: d.destino,
                                choferId: c.chofer_id ?? undefined,
                              })}
                              hrefDeViaje={(v) =>
                                hrefListado({
                                  destino: d.destino,
                                  choferId: c.chofer_id ?? undefined,
                                  viajeId: v.id,
                                })
                              }
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
                      <div className="border-t-2 border-[#B45309]/40 bg-[#B45309]/[0.07]">
                        <p className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold text-[#B45309]">
                          <UserRound size={14} />
                          {d.sinChofer} viaje{d.sinChofer !== 1 ? "s" : ""} sin chofer asignado
                        </p>
                        <TablaViajes
                          viajes={d.sinChoferDetalle}
                          href={hrefListado({ destino: d.destino, faltaChofer: true })}
                          hrefDeViaje={(v) => hrefListado({ destino: d.destino, viajeId: v.id })}
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
