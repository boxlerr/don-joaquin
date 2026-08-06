"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select, SelectTrigger, SelectContent, SelectItem,
} from "@/components/ui/select";
import { ChevronRight, ChevronDown, Loader2, MapPin } from "lucide-react";
import {
  getViajesChoferMesAction,
  setViajeZonaAction,
  type SueldoChoferRow,
  type ViajeZonaRow,
} from "./actions";

const num = (n: number, d = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const ZONAS: { value: string; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "sur", label: "Al sur" },
  { value: "pozo", label: "Zona petrolera" },
];
const zonaLabel = (z: string | null) => ZONAS.find((o) => o.value === (z ?? "normal"))!.label;

// Mismo criterio que la planilla de admin: encabezado y totales fijos, filas
// compactas y el scroll adentro de la caja, así entra la mayor cantidad de
// choferes posible sin arrastrar toda la página.
const thCls =
  "h-8 px-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap bg-muted border-b border-border";
const tdCls = "py-1 px-2 border-b border-border/50";
const tfCls =
  "px-2 py-1.5 text-right font-mono text-[13px] tabular-nums whitespace-nowrap bg-muted border-t border-border";

/** El detalle de viajes de un chofer. Igual en la tabla y en la tarjeta. */
function ViajesZonaPanel({
  cargando,
  viajes,
  savingViaje,
  onZonaChange,
}: {
  cargando: boolean;
  viajes: ViajeZonaRow[];
  savingViaje: string | null;
  onZonaChange: (viajeId: string, valor: string) => void;
}) {
  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Cargando viajes…
      </div>
    );
  }
  if (viajes.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">Sin viajes cerrados.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
        Marcá la zona de cada viaje (para discriminar sur / pozo)
      </p>
      {viajes.map((v) => (
        <div
          key={v.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 py-1.5 text-xs last:border-0"
        >
          <span className="w-16 shrink-0 font-mono text-muted-foreground">{fmtFecha(v.fecha)}</span>
          <span className="w-20 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
            {v.codigo}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-foreground">
            <MapPin size={12} className="shrink-0 text-muted-foreground" />
            {v.destino}
          </span>
          <span className="w-24 shrink-0 text-right font-mono text-muted-foreground">
            {num(v.km_con_carga + v.km_vacios)} km
          </span>
          <div onClick={(ev) => ev.stopPropagation()} className="shrink-0">
            <Select
              value={v.zona ?? "normal"}
              onValueChange={(val) => onZonaChange(v.id, (val as string) ?? "normal")}
            >
              <SelectTrigger size="sm" disabled={savingViaje === v.id} className="w-[9.5rem] text-xs">
                <span className={v.zona ? "" : "text-muted-foreground"}>{zonaLabel(v.zona)}</span>
              </SelectTrigger>
              <SelectContent>
                {ZONAS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SueldosClient({
  resumen,
  month,
}: {
  resumen: SueldoChoferRow[];
  month: string;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viajes, setViajes] = useState<Record<string, ViajeZonaRow[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingViaje, setSavingViaje] = useState<string | null>(null);

  const totales = useMemo(
    () =>
      resumen.reduce(
        (t, r) => ({
          viajes: t.viajes + r.viajes,
          km_con_carga: t.km_con_carga + r.km_con_carga,
          km_vacios: t.km_vacios + r.km_vacios,
          km_total: t.km_total + r.km_total,
          tonelaje: t.tonelaje + r.tonelaje,
          sur: t.sur + r.sur,
          pozo: t.pozo + r.pozo,
        }),
        { viajes: 0, km_con_carga: 0, km_vacios: 0, km_total: 0, tonelaje: 0, sur: 0, pozo: 0 },
      ),
    [resumen],
  );

  const toggleExpand = async (choferId: string) => {
    if (expandedId === choferId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(choferId);
    if (!viajes[choferId]) {
      setLoadingId(choferId);
      const data = await getViajesChoferMesAction(choferId, month);
      setViajes((prev) => ({ ...prev, [choferId]: data }));
      setLoadingId(null);
    }
  };

  const onZonaChange = async (choferId: string, viajeId: string, valor: string) => {
    const zona = valor === "normal" ? null : (valor as "sur" | "pozo");
    setSavingViaje(viajeId);
    // optimista
    setViajes((prev) => ({
      ...prev,
      [choferId]: (prev[choferId] ?? []).map((v) => (v.id === viajeId ? { ...v, zona } : v)),
    }));
    await setViajeZonaAction(viajeId, zona);
    setSavingViaje(null);
    router.refresh(); // recalcular los totales del resumen
  };

  if (resumen.length === 0) {
    return (
      <div className="bg-card rounded-[8px] border border-border shadow-sm py-16 text-center text-muted-foreground text-sm">
        No hay viajes cerrados en este período.
      </div>
    );
  }

  return (
    // El alto sale de lo que sobra en la pantalla, no de un calc() adivinado.
    <div className="bg-card rounded-[8px] border border-border shadow-sm flex flex-col min-h-0 h-full">
      {/* Celular: una tarjeta por chofer. La planilla son 9 columnas de números
          y de costado no se lee; acá el nombre manda y los km quedan abajo. */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-border">
        {resumen.map((r) => {
          const abierto = expandedId === r.chofer_id;
          return (
            <div key={r.chofer_id}>
              <button
                type="button"
                onClick={() => toggleExpand(r.chofer_id)}
                aria-expanded={abierto}
                className="flex w-full items-start gap-2 px-3 py-3 text-left"
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {r.chofer}
                  </span>
                  <span className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                    {[
                      ["Viajes", num(r.viajes)],
                      ["Km 100%", num(r.km_con_carga)],
                      ["Km vacíos", num(r.km_vacios)],
                      ["Km total", num(r.km_total)],
                      ["Toneladas", num(r.tonelaje, 1)],
                    ].map(([label, valor]) => (
                      <span key={label} className="block min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          {label}
                        </span>
                        <span className="block truncate font-mono text-[13px] tabular-nums text-foreground">
                          {valor}
                        </span>
                      </span>
                    ))}
                  </span>
                  {(r.sur > 0 || r.pozo > 0) && (
                    <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {r.sur > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-1.5 py-0.5 font-medium text-sky-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Sur {r.sur}
                        </span>
                      )}
                      {r.pozo > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-1.5 py-0.5 font-medium text-orange-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Pozo {r.pozo}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
              {abierto && (
                <div className="bg-muted/20 px-3 pb-3">
                  <ViajesZonaPanel
                    cargando={loadingId === r.chofer_id}
                    viajes={viajes[r.chofer_id] ?? []}
                    savingViaje={savingViaje}
                    onZonaChange={(viajeId, valor) => onZonaChange(r.chofer_id, viajeId, valor)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Los totales quedan fijos abajo, como la fila de totales de la tabla. */}
      <div className="md:hidden shrink-0 border-t border-border bg-muted px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {resumen.length} chofer{resumen.length === 1 ? "" : "es"}
        </p>
        <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1.5">
          {[
            ["Viajes", num(totales.viajes)],
            ["Km 100%", num(totales.km_con_carga)],
            ["Km vacíos", num(totales.km_vacios)],
            ["Km total", num(totales.km_total)],
            ["Toneladas", num(totales.tonelaje, 1)],
            ["Sur / Pozo", `${totales.sur || "—"} / ${totales.pozo || "—"}`],
          ].map(([label, valor]) => (
            <div key={label} className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
              <p className="truncate font-mono text-[13px] tabular-nums text-foreground">{valor}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden md:block flex-1 min-h-[12rem] overflow-auto">
        <table className="w-full min-w-[820px] text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${thCls} w-8 pl-4`} />
              {/* Columna identificadora fija: al scrollear la planilla de
                  costado en el celular, el nombre no se pierde. */}
              <th className={`${thCls} text-left sticky left-0 z-30 shadow-[1px_1px_0_0_rgba(0,0,0,0.08)]`}>Chofer</th>
              <th className={`${thCls} text-right`}>Viajes</th>
              <th className={`${thCls} text-right`}>Km 100%</th>
              <th className={`${thCls} text-right`}>Km vacíos</th>
              <th className={`${thCls} text-right`}>Km total</th>
              <th className={`${thCls} text-right`}>Toneladas</th>
              <th className={`${thCls} text-right`}>Sur</th>
              <th className={`${thCls} text-right pr-4`}>Pozo</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <Fragment key={r.chofer_id}>
                <tr
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(r.chofer_id)}
                >
                  <td className={`${tdCls} pl-4 text-muted-foreground`}>
                    {expandedId === r.chofer_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className={`${tdCls} text-[13px] font-medium text-foreground whitespace-nowrap sticky left-0 z-10 bg-card shadow-[1px_0_0_0_rgba(0,0,0,0.08)]`}>{r.chofer}</td>
                  <td className={`${tdCls} text-right text-muted-foreground font-mono text-[13px] tabular-nums`}>{num(r.viajes)}</td>
                  <td className={`${tdCls} text-right text-foreground font-mono text-[13px] font-semibold tabular-nums`}>{num(r.km_con_carga)}</td>
                  <td className={`${tdCls} text-right text-muted-foreground font-mono text-[13px] tabular-nums`}>{num(r.km_vacios)}</td>
                  <td className={`${tdCls} text-right text-muted-foreground font-mono text-[13px] tabular-nums`}>{num(r.km_total)}</td>
                  <td className={`${tdCls} text-right text-muted-foreground font-mono text-[13px] tabular-nums`}>{num(r.tonelaje, 1)}</td>
                  <td className={`${tdCls} text-right font-mono text-[13px] tabular-nums`}>
                    {r.sur > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />{r.sur}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className={`${tdCls} text-right pr-4 font-mono text-[13px] tabular-nums`}>
                    {r.pozo > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />{r.pozo}
                      </span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>

                {expandedId === r.chofer_id && (
                  <tr className="bg-muted/20">
                    <td colSpan={9} className="px-4 py-3 border-b border-border/50">
                      <ViajesZonaPanel
                        cargando={loadingId === r.chofer_id}
                        viajes={viajes[r.chofer_id] ?? []}
                        savingViaje={savingViaje}
                        onZonaChange={(viajeId, valor) => onZonaChange(r.chofer_id, viajeId, valor)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr>
              <td className={`${tfCls} pl-4 w-8`} />
              <td className={`${tfCls} text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground sticky left-0 z-30 shadow-[1px_-1px_0_0_rgba(0,0,0,0.08)]`}>
                {resumen.length} chofer{resumen.length === 1 ? "" : "es"}
              </td>
              <td className={`${tfCls} text-foreground`}>{num(totales.viajes)}</td>
              <td className={`${tfCls} font-semibold text-foreground`}>{num(totales.km_con_carga)}</td>
              <td className={`${tfCls} text-foreground`}>{num(totales.km_vacios)}</td>
              <td className={`${tfCls} text-foreground`}>{num(totales.km_total)}</td>
              <td className={`${tfCls} text-foreground`}>{num(totales.tonelaje, 1)}</td>
              <td className={`${tfCls} text-foreground`}>{totales.sur || "—"}</td>
              <td className={`${tfCls} pr-4 text-foreground`}>{totales.pozo || "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
