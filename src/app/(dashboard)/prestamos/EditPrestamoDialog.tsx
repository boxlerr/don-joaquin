"use client";

// Edición de la ficha del préstamo: banco, monto, cuota, tasa y moneda.
//
// Lo que NO está acá a propósito:
//   - Agregar meses: se hace en la tira de cuotas, abriendo el préstamo en la
//     tabla. Ahí se ve de una si van antes o después de las que ya hay.
//   - "Qué falta cargar": ya no se escribe. Es la marca que dejó la carga
//     inicial del Excel; acá sólo se muestra y se apaga cuando se completó.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import {
  rehacerCronogramaAction,
  setCuotaPagadaAction,
  updatePrestamoAction,
  type PrestamoRow,
} from "./actions";
import { listaBancos, inicialesBanco, marcaBanco } from "./bancos";
import { armarCronograma } from "./cronograma";
import { etiquetaFaltante, faltantesVigentes, siguePendiente, type Faltante } from "./faltantes";
import { Check, Repeat } from "lucide-react";

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Encabezado del diálogo: el logo del banco, o sus iniciales con su color. */
function LogoBanco({ banco }: { banco: string }) {
  const { logo, color } = marcaBanco(banco);
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${color}14` }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- SVG local: no hay nada que optimizar
        <img src={logo} alt="" className="max-h-6 max-w-8 object-contain" />
      ) : (
        <span className="text-sm font-semibold" style={{ color }}>
          {inicialesBanco(banco)}
        </span>
      )}
    </span>
  );
}

function TituloBloque({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
      {children}
    </h3>
  );
}

export default function EditPrestamoDialog({
  prestamo,
  open,
  onOpenChange,
  bancos = [],
}: {
  prestamo: PrestamoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Bancos ya en uso, para el desplegable. */
  bancos?: string[];
}) {
  const router = useRouter();
  const [banco, setBanco] = useState(prestamo?.banco ?? "");
  const [detalle, setDetalle] = useState(prestamo?.detalle ?? "");
  const [referencia, setReferencia] = useState(prestamo?.referencia ?? "");
  const [tasa, setTasa] = useState(prestamo?.tasa != null ? String(prestamo.tasa) : "");
  const [importe, setImporte] = useState(
    prestamo && prestamo.importe_cuota > 0 ? String(prestamo.importe_cuota) : "",
  );
  const [moneda, setMoneda] = useState<"ARS" | "USD">(prestamo?.moneda === "USD" ? "USD" : "ARS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Cronograma -----------------------------------------------------------
  const cuotas = prestamo?.cuotas ?? [];
  const cargadas = cuotas.length;
  const pagadas = prestamo?.pagadas ?? 0;
  const recurrente = prestamo?.es_recurrente ?? false;
  /** La última que figura pagada: es la que hay que destildar si en verdad falta. */
  const ultimaPagada = [...cuotas].filter((c) => c.pagada).sort((a, b) => b.nro - a.nro)[0] ?? null;
  /** Sin ninguna cuota por pagar la tabla lo muestra como Cancelado. */
  const figuraCancelado = !recurrente && cargadas > 0 && cargadas === pagadas;

  const [desmarcarUltima, setDesmarcarUltima] = useState(false);
  /** La nota que dejó la carga del Excel; se apaga cuando el dato ya está. */
  const [notaResuelta, setNotaResuelta] = useState(false);
  const [rehacerAbierto, setRehacerAbierto] = useState(false);
  const [rTotal, setRTotal] = useState(String(cargadas || prestamo?.cuotas_total || ""));
  // Arranca en la que el sistema cree que sigue, acotada al total: así el
  // preview abre diciendo lo que ya pasa hoy y sólo cambia lo que se toca.
  const [rProxima, setRProxima] = useState(String(Math.min(pagadas + 1, cargadas || 1)));
  const [rFecha, setRFecha] = useState(
    prestamo?.proxima?.fecha_vencimiento ??
      [...cuotas].sort((a, b) => b.fecha_vencimiento.localeCompare(a.fecha_vencimiento))[0]
        ?.fecha_vencimiento ??
      "",
  );

  if (!prestamo) return null;

  const importeNum = importe.trim() === "" ? 0 : Number(importe);
  const nota = prestamo.datos_faltantes?.trim() || null;

  const rTotalNum = Number.parseInt(rTotal, 10);
  const rProximaNum = Number.parseInt(rProxima, 10);
  const planNuevo =
    rehacerAbierto &&
    Number.isInteger(rTotalNum) &&
    rTotalNum > 0 &&
    rTotalNum <= 600 &&
    Number.isInteger(rProximaNum) &&
    rProximaNum >= 1 &&
    rProximaNum <= rTotalNum + 1 &&
    /^\d{4}-\d{2}-\d{2}$/.test(rFecha)
      ? armarCronograma({ cuotasTotal: rTotalNum, proximaNro: rProximaNum, proximaFecha: rFecha })
      : null;

  const guardar = async () => {
    if (!banco.trim()) {
      setError("Elegí o escribí el banco.");
      return;
    }
    if (rehacerAbierto && !planNuevo) {
      setError("Revisá los números: cuántas cuotas son, por cuál va y cuándo vence.");
      return;
    }
    setLoading(true);
    setError(null);

    // La ficha primero: si cambió el importe, el cronograma que se rehaga
    // después tiene que salir con el valor nuevo, no con el viejo.
    const res = await updatePrestamoAction(prestamo.id, {
      banco,
      detalle: detalle.trim() || null,
      referencia: referencia.trim() || null,
      tasa: tasa.trim() === "" ? null : Number(tasa),
      importe_cuota: importeNum,
      moneda,
      // Sólo se toca si el usuario dijo que ya está: si no, queda como vino.
      ...(notaResuelta ? { datos_faltantes: null } : {}),
    });
    if ("error" in res) {
      setLoading(false);
      setError(res.error);
      return;
    }

    if (desmarcarUltima && ultimaPagada) {
      const r = await setCuotaPagadaAction(ultimaPagada.id, false);
      if ("error" in r) {
        setLoading(false);
        setError(r.error);
        return;
      }
    }

    if (rehacerAbierto && planNuevo) {
      const r = await rehacerCronogramaAction(prestamo.id, {
        cuotas_total: rTotalNum,
        proxima_cuota_nro: rProximaNum,
        proxima_fecha: rFecha,
      });
      if ("error" in r) {
        setLoading(false);
        setError(r.error);
        return;
      }
    }

    setLoading(false);
    onOpenChange(false);
    router.refresh();
  };

  // Lo que hoy tiene el formulario, para evaluar en vivo qué falta todavía.
  const enElFormulario = {
    detalle: detalle.trim() || null,
    importe_cuota: importeNum,
    tasa: tasa.trim() === "" ? null : Number(tasa),
    faltantes: [] as string[],
    datos_faltantes: null,
  };
  const marcasIniciales: Faltante[] = faltantesVigentes({
    detalle: prestamo.detalle,
    importe_cuota: prestamo.importe_cuota,
    tasa: prestamo.tasa,
    faltantes: prestamo.faltantes ?? [],
    datos_faltantes: null,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="gap-0 p-6 sm:max-w-[880px]">
        <DialogHeader className="-mx-6 border-b border-border px-6 pb-4 pt-1">
          <div className="flex items-start gap-4 pr-8">
            <LogoBanco banco={prestamo.banco} />
            <div className="min-w-0">
              <DialogTitle className="text-lg text-foreground">
                {prestamo.banco}
                {prestamo.referencia
                  ? ` · ${prestamo.referencia}`
                  : prestamo.detalle
                    ? ` · ${prestamo.detalle}`
                    : ""}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {recurrente ? (
                  <span className="inline-flex items-center gap-1">
                    <Repeat size={11} className="text-primary" />
                    Se paga todos los meses
                    {prestamo.dia_vencimiento ? `, el ${prestamo.dia_vencimiento}` : ""}.
                  </span>
                ) : figuraCancelado ? (
                  `${cargadas === 1 ? "Su única cuota figura pagada" : `Las ${cargadas} cuotas figuran pagadas`}.`
                ) : (
                  `Cuota ${pagadas + 1} de ${cargadas || prestamo.cuotas_total}.`
                )}{" "}
                El importe nuevo se aplica a las que faltan pagar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-5">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {/* ---------------------------- Ficha ---------------------------- */}
            <section className="space-y-3">
              <TituloBloque>Datos del préstamo</TituloBloque>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PlaceCombobox
                  label="Banco"
                  name="banco"
                  value={banco}
                  onValueChange={setBanco}
                  options={listaBancos(bancos).map((b) => ({ id: b, label: b }))}
                  placeholder="Elegí o escribí uno nuevo"
                />
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Monto del préstamo
                  </Label>
                  <Input
                    value={detalle}
                    onChange={(e) => setDetalle(e.target.value)}
                    placeholder="Ej: $50.000.000"
                  />
                </div>
              </div>

              {/* La planilla a veces identifica al préstamo con un nombre en vez
                  de un monto (SUECA, FORTE CAR). Va acá y no en el monto. */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Referencia{" "}
                  <span className="font-normal text-muted-foreground/70">
                    (cómo lo llaman en la planilla)
                  </span>
                </Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ej: SUECA, FORTE CAR, TARJ.PYME"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_7rem_auto]">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Importe de la cuota
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    placeholder="Ej: 4500000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Tasa %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tasa}
                    onChange={(e) => setTasa(e.target.value)}
                    placeholder="Ej: 45"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Moneda</Label>
                  <div className="inline-flex h-10 overflow-hidden rounded-[6px] border border-border">
                    {(["ARS", "USD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMoneda(m)}
                        aria-pressed={moneda === m}
                        className={`px-3 text-xs font-medium transition-colors ${
                          moneda === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m === "ARS" ? "Pesos" : "Dólares"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* -------------------------- Cronograma ------------------------- */}
            <section className="space-y-3">
              <TituloBloque>Cuotas</TituloBloque>

              <div className="space-y-3 rounded-[6px] border border-border px-3 py-2.5">
                <p className="text-[12px] text-foreground">
                  {recurrente ? (
                    "Se agenda mes a mes, sin fecha de fin."
                  ) : cargadas === 0 ? (
                    <span className="text-[#B45309]">No tiene ninguna cuota cargada.</span>
                  ) : (
                    <>
                      <b className="tabular-nums">{cargadas}</b> cuota{cargadas !== 1 ? "s" : ""} ·{" "}
                      <b className="tabular-nums">{pagadas}</b> pagada{pagadas !== 1 ? "s" : ""}
                      {prestamo.proxima ? (
                        <> · próxima el <b>{fmtFecha(prestamo.proxima.fecha_vencimiento)}</b></>
                      ) : null}
                    </>
                  )}
                </p>

                {/* El motivo real de que un préstamo vivo desaparezca de los
                    vencimientos: quedó sin ninguna cuota impaga. */}
                {figuraCancelado && ultimaPagada && !rehacerAbierto && (
                  <label className="flex items-start gap-2 border-l-2 border-[#B45309] pl-3">
                    <input
                      type="checkbox"
                      checked={desmarcarUltima}
                      onChange={(e) => setDesmarcarUltima(e.target.checked)}
                      className="mt-0.5 size-3.5 accent-[#0088D1]"
                    />
                    <span className="text-[12px] leading-snug text-[#B45309]">
                      Figura como <b>Cancelado</b>. La cuota {ultimaPagada.nro} (
                      {fmtFecha(ultimaPagada.fecha_vencimiento)}) todavía no está pagada.
                    </span>
                  </label>
                )}

                {!recurrente &&
                  (!rehacerAbierto ? (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRehacerAbierto(true);
                          setDesmarcarUltima(false);
                        }}
                        className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
                      >
                        ¿Los números no coinciden? Rehacer el cronograma
                      </button>
                      <p className="text-[11px] text-muted-foreground">
                        Los meses se agregan abriendo el préstamo en la tabla.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 border-t border-border pt-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Rehacer el cronograma
                        </span>
                        <button
                          type="button"
                          onClick={() => setRehacerAbierto(false)}
                          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Cuotas totales
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={rTotal}
                            onChange={(e) => setRTotal(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Va por la Nº
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={rProxima}
                            onChange={(e) => setRProxima(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Vence el
                          </Label>
                          <Input
                            type="date"
                            value={rFecha}
                            onChange={(e) => setRFecha(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {planNuevo ? (
                          <>
                            Quedan{" "}
                            <b className="text-foreground">
                              {planNuevo.filter((c) => c.pagada).length}
                            </b>{" "}
                            pagadas y{" "}
                            <b className="text-foreground">
                              {planNuevo.filter((c) => !c.pagada).length}
                            </b>{" "}
                            por pagar, de {fmtFecha(planNuevo[0]!.fecha_vencimiento)} a{" "}
                            {fmtFecha(planNuevo.at(-1)!.fecha_vencimiento)}.
                            {planNuevo.length < cargadas ? (
                              <> Se borran {cargadas - planNuevo.length} del final.</>
                            ) : null}{" "}
                            <span className="text-[#B45309]">
                              Se recalculan TODAS las fechas.
                            </span>
                          </>
                        ) : (
                          "Rearma el calendario entero, una cuota por mes."
                        )}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Lo que quedó marcado en la carga inicial del Excel. No se
                  escribe: se muestra, y se apaga cuando el dato ya está. */}
              {(marcasIniciales.length > 0 || nota) && (
                <>
                  <TituloBloque>Vino incompleto del Excel</TituloBloque>
                  <div className="space-y-1.5 rounded-[6px] border border-border px-3 py-2.5">
                    {marcasIniciales.map((f) => {
                      const listo = !siguePendiente(f, enElFormulario);
                      return (
                        <p
                          key={f}
                          className={`flex items-center gap-1.5 text-[12px] ${listo ? "text-[#059669]" : "text-[#B45309]"}`}
                        >
                          {listo ? (
                            <Check size={12} className="shrink-0" />
                          ) : (
                            <span className="inline-block size-1.5 shrink-0 rounded-full bg-current" />
                          )}
                          <span className={listo ? "line-through decoration-1" : ""}>
                            Falta {etiquetaFaltante(f)}
                          </span>
                        </p>
                      );
                    })}
                    {nota && (
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={notaResuelta}
                          onChange={(e) => setNotaResuelta(e.target.checked)}
                          className="mt-0.5 size-3.5 accent-[#0088D1]"
                        />
                        <span
                          className={`text-[12px] leading-snug ${notaResuelta ? "text-[#059669] line-through decoration-1" : "text-[#B45309]"}`}
                        >
                          Falta {nota}
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="mt-5 gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-muted-foreground"
          >
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={guardar} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
