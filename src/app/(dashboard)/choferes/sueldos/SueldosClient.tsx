"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Wallet, ChevronRight, ChevronDown, Loader2, MapPin } from "lucide-react";
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

  const onZonaChange = async (choferId: string, viajeId: string, zonaRaw: string) => {
    const zona = zonaRaw === "" ? null : (zonaRaw as "sur" | "pozo");
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

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Wallet size={16} className="text-primary" />
        <h2 className="text-foreground text-sm font-semibold">Totales por chofer</h2>
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-8 pl-6" />
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chofer</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Viajes</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Km 100%</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Km vacíos</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Km total</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Toneladas</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Sur</TableHead>
            <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Pozo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resumen.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-16 text-center text-muted-foreground text-sm">
                No hay viajes cerrados en este período.
              </TableCell>
            </TableRow>
          ) : (
            resumen.map((r) => (
              <Fragment key={r.chofer_id}>
                <TableRow
                  className="hover:bg-muted/10 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(r.chofer_id)}
                >
                  <TableCell className="pl-6 text-muted-foreground">
                    {expandedId === r.chofer_id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{r.chofer}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">{num(r.viajes)}</TableCell>
                  <TableCell className="text-right text-foreground font-mono font-semibold">{num(r.km_con_carga)}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">{num(r.km_vacios)}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">{num(r.km_total)}</TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">{num(r.tonelaje, 1)}</TableCell>
                  <TableCell className="text-right">
                    {r.sur > 0 ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-200/50">{r.sur}</span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {r.pozo > 0 ? (
                      <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-orange-200/50">{r.pozo}</span>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                </TableRow>

                {expandedId === r.chofer_id && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={9} className="px-6 py-3">
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
                              <select
                                value={v.zona ?? ""}
                                disabled={savingViaje === v.id}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onZonaChange(r.chofer_id, v.id, e.target.value)}
                                className="h-7 rounded-md border border-border bg-card px-2 text-[11px] text-foreground shrink-0"
                              >
                                <option value="">Normal</option>
                                <option value="sur">Al sur</option>
                                <option value="pozo">Zona petrolera</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
