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
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="overflow-auto max-h-[calc(100dvh-16rem)] min-h-[15rem]">
        <table className="w-full min-w-[820px] text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${thCls} w-8 pl-4`} />
              <th className={`${thCls} text-left`}>Chofer</th>
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
                  <td className={`${tdCls} text-[13px] font-medium text-foreground whitespace-nowrap`}>{r.chofer}</td>
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
                      {loadingId === r.chofer_id ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Loader2 size={13} className="animate-spin" /> Cargando viajes…
                        </div>
                      ) : (viajes[r.chofer_id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Sin viajes cerrados.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">
                            Marcá la zona de cada viaje (para discriminar sur / pozo)
                          </p>
                          {(viajes[r.chofer_id] ?? []).map((v) => (
                            <div key={v.id} className="flex items-center gap-3 text-xs py-1 border-b border-border/40 last:border-0">
                              <span className="text-muted-foreground font-mono w-16 shrink-0">{fmtFecha(v.fecha)}</span>
                              <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0 truncate">{v.codigo}</span>
                              <span className="flex items-center gap-1 text-foreground flex-1 min-w-0 truncate">
                                <MapPin size={12} className="text-muted-foreground shrink-0" />
                                {v.destino}
                              </span>
                              <span className="text-muted-foreground font-mono w-24 shrink-0 text-right">{num(v.km_con_carga + v.km_vacios)} km</span>
                              <div onClick={(ev) => ev.stopPropagation()} className="shrink-0">
                                <Select
                                  value={v.zona ?? "normal"}
                                  onValueChange={(val) => onZonaChange(r.chofer_id, v.id, (val as string) ?? "normal")}
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
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr>
              <td className={`${tfCls} pl-4 w-8`} />
              <td className={`${tfCls} text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground`}>
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
