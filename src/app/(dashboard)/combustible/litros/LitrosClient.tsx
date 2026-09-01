"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fuel, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buscarTarifa,
  calcularLitros,
  destinosDe,
  origenesDe,
  type TarifaGasoil,
} from "@/domain/gasoil/litros-por-tonelada";
import {
  guardarAutorizacionAction,
  guardarTarifaAction,
  type AutorizacionRow,
  type ChoferOpcion,
} from "./actions";

/**
 * Litros para la vuelta.
 *
 * Nico, 31/08/2026: *"que los choferes puedan cargar las toneladas para que les
 * devuelva los litros que tiene que cargar"*. Por ahora lo consulta la oficina y
 * se lo pasa al chofer — 76 de los 79 choferes activos no tienen mail, así que
 * darles usuario es un proyecto aparte.
 *
 * La cuenta se muestra apenas hay tramo y toneladas: **ver el número no depende
 * de guardar nada**. Guardar es el paso siguiente y sirve para otra cosa —
 * dejar anotado qué se autorizó, para poder compararlo después contra lo que se
 * cargó de verdad en el surtidor.
 */

const num = (n: number, dec = 1) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export default function LitrosClient({
  tarifas,
  choferes,
  autorizaciones,
  canWrite,
}: {
  tarifas: TarifaGasoil[];
  choferes: ChoferOpcion[];
  autorizaciones: AutorizacionRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [toneladas, setToneladas] = useState("");
  const [choferId, setChoferId] = useState("");
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<number | null>(null);

  const origenes = useMemo(() => origenesDe(tarifas), [tarifas]);
  const destinos = useMemo(() => destinosDe(tarifas, origenId), [tarifas, origenId]);
  const tarifa = useMemo(
    () => buscarTarifa(tarifas, origenId, destinoId),
    [tarifas, origenId, destinoId],
  );

  const tn = toneladas.trim() === "" ? null : Number(toneladas.replace(",", "."));
  const calculo = useMemo(() => calcularLitros(tarifa, tn), [tarifa, tn]);

  // Cambiar de origen puede dejar elegido un destino que ese origen no tiene.
  const cambiarOrigen = (v: string) => {
    setOrigenId(v);
    setGuardado(null);
    if (v && !tarifas.some((t) => t.origenId === v && t.destinoId === destinoId)) setDestinoId("");
  };

  const guardar = async () => {
    if (!calculo.ok) return;
    setGuardando(true);
    setError(null);
    const res = await guardarAutorizacionAction({
      choferId: choferId || null,
      origenId,
      destinoId,
      toneladas: calculo.toneladas,
      observaciones: obs,
    });
    setGuardando(false);
    if ("error" in res) return setError(res.error);
    setGuardado(res.litros);
    setToneladas("");
    setChoferId("");
    setObs("");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* ── La cuenta ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Desde</Label>
            <Combobox
              options={origenes.map((o) => ({ id: o.id, label: o.nombre }))}
              value={origenId}
              onValueChange={cambiarOrigen}
              placeholder="Origen"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Hasta</Label>
            <Combobox
              options={destinos.map((d) => ({ id: d.id, label: d.nombre }))}
              value={destinoId}
              onValueChange={(v) => {
                setDestinoId(v);
                setGuardado(null);
              }}
              placeholder={origenId ? "Destino" : "Elegí el origen primero"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tn" className="text-xs font-semibold text-muted-foreground">
              Toneladas cargadas
            </Label>
            <Input
              id="tn"
              inputMode="decimal"
              value={toneladas}
              onChange={(e) => {
                setToneladas(e.target.value);
                setGuardado(null);
              }}
              placeholder="35"
              autoComplete="off"
            />
          </div>

          {/* El resultado, en el mismo bloque: es lo que se vino a buscar. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Le corresponden
            </Label>
            <div className="flex h-9 items-baseline gap-1.5">
              {calculo.ok ? (
                <>
                  <Fuel size={18} className="self-center text-muted-foreground" />
                  <span className="text-[26px] font-semibold leading-none tabular-nums text-foreground">
                    {num(calculo.litros)}
                  </span>
                  <span className="text-sm text-muted-foreground">litros</span>
                </>
              ) : (
                <span className="self-center text-sm text-muted-foreground">
                  {tarifa || (origenId && destinoId) ? calculo.mensaje : "Elegí el tramo"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* De dónde sale el número. Sin esto es un número mágico. */}
        {calculo.ok && (
          <p className="mt-3 border-t border-border/60 pt-3 text-[13px] text-muted-foreground">
            {num(calculo.toneladas, 2)} toneladas × {num(calculo.litrosPorTonelada, 2)} litros por
            tonelada.
          </p>
        )}
      </div>

      {/* ── Dejarlo anotado ──────────────────────────────────────────────── */}
      {canWrite && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Anotar lo autorizado</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Queda registrado a quién se le dijo y cuánto, para poder compararlo después con lo que
            cargó de verdad.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Chofer</Label>
              <Combobox
                options={choferes.map((c) => ({ id: c.id, label: c.nombre }))}
                value={choferId}
                onValueChange={setChoferId}
                placeholder="Sin especificar"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="obs" className="text-xs font-semibold text-muted-foreground">
                Nota (opcional)
              </Label>
              <Input
                id="obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Patente, remito, lo que sirva para encontrarlo después"
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}
          {guardado != null && !error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-[#15803D]">
              <Check size={15} /> Anotado: {num(guardado)} litros.
            </p>
          )}

          <div className="mt-4">
            <Button onClick={guardar} disabled={!calculo.ok || guardando}>
              {guardando ? "Guardando…" : "Anotar"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Lo último autorizado ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-foreground">Lo último que se autorizó</h2>
        </div>
        {autorizaciones.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
            Todavía no se anotó ninguno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Tramo</TableHead>
                  <TableHead className="text-right">Tn</TableHead>
                  <TableHead className="text-right">L/Tn</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead>Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autorizaciones.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{a.chofer ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {a.origen} → {a.destino}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(a.toneladas, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {num(a.litros_por_tonelada, 2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {num(a.litros)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.observaciones ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CuadroRindes tarifas={tarifas} canWrite={canWrite} />
    </div>
  );
}

/**
 * El cuadro que pasó Nico, editable.
 *
 * Va abajo y no arriba porque no es lo que se viene a hacer todos los días: se
 * toca cuando cambia el precio del gasoil o cuando un tramo rinde distinto. Lo
 * ya autorizado no se mueve — cada autorización guardó su coeficiente.
 */
function CuadroRindes({ tarifas, canWrite }: { tarifas: TarifaGasoil[]; canWrite: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clave = (t: TarifaGasoil) => `${t.origenId}|${t.destinoId}`;
  const ordenadas = useMemo(
    () =>
      [...tarifas].sort(
        (a, b) => a.origen.localeCompare(b.origen, "es") || a.destino.localeCompare(b.destino, "es"),
      ),
    [tarifas],
  );

  const guardar = async (t: TarifaGasoil) => {
    const n = Number(valor.replace(",", "."));
    setError(null);
    const res = await guardarTarifaAction({
      origenId: t.origenId,
      destinoId: t.destinoId,
      litrosPorTonelada: n,
    });
    if ("error" in res) return setError(res.error);
    setEditando(null);
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">Cuánto rinde cada tramo</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Litros de gasoil por tonelada. Cambiarlo acá no toca nada de lo ya autorizado.
        </p>
      </div>
      {error && <p className="px-4 pt-3 text-sm text-[#B91C1C] sm:px-5">{error}</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead className="text-right">Litros por tonelada</TableHead>
              {canWrite && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((t) => {
              const k = clave(t);
              const enEdicion = editando === k;
              return (
                <TableRow key={k}>
                  <TableCell className="whitespace-nowrap">{t.origen}</TableCell>
                  <TableCell className="whitespace-nowrap">{t.destino}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {enEdicion ? (
                      <Input
                        autoFocus
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void guardar(t);
                          if (e.key === "Escape") setEditando(null);
                        }}
                        className="ml-auto h-8 w-24 text-right"
                      />
                    ) : (
                      num(t.litrosPorTonelada, 2)
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      {enEdicion ? (
                        <Button size="sm" variant="outline" onClick={() => void guardar(t)}>
                          Guardar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={`Cambiar el rinde de ${t.origen} → ${t.destino}`}
                          onClick={() => {
                            setEditando(k);
                            setValor(String(t.litrosPorTonelada));
                          }}
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
