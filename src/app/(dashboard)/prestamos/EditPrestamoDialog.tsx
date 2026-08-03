"use client";

// Edición de la ficha del préstamo. Existe sobre todo para completar los que
// entraron desde la planilla con datos a medias: al cargarles lo que faltaba, el
// aviso de "falta completar" se apaga solo.
//
// Y para arreglar el cronograma, que es lo que más se equivoca al importar: un
// préstamo que sigue vivo puede haber entrado como "1 de 1". Hasta ahora la
// única salida era borrarlo y volver a cargarlo, perdiendo los pagos.

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
  agregarCuotasAction,
  rehacerCronogramaAction,
  setCuotaPagadaAction,
  updatePrestamoAction,
  type PrestamoRow,
} from "./actions";
import { listaBancos, inicialesBanco, marcaBanco } from "./bancos";
import { armarCronograma, mesesAlFinal, mesesAlInicio } from "./cronograma";
import { etiquetaFaltante, faltantesVigentes, siguePendiente, type Faltante } from "./faltantes";
import { Check, CalendarPlus, Repeat, TrendingUp } from "lucide-react";

const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

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
  const [falta, setFalta] = useState(prestamo?.datos_faltantes ?? "");
  const [variable, setVariable] = useState(prestamo?.cuota_variable ?? false);
  const [recurrente, setRecurrente] = useState(prestamo?.es_recurrente ?? false);
  const [diaMes, setDiaMes] = useState(
    prestamo?.dia_vencimiento != null ? String(prestamo.dia_vencimiento) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Cronograma -----------------------------------------------------------
  const cuotas = prestamo?.cuotas ?? [];
  const cargadas = cuotas.length;
  const pagadas = prestamo?.pagadas ?? 0;
  const impagas = cargadas - pagadas;
  /** La última que figura pagada: es la que hay que destildar si en verdad falta. */
  const ultimaPagada = [...cuotas].filter((c) => c.pagada).sort((a, b) => b.nro - a.nro)[0] ?? null;
  /** Sin ninguna cuota por pagar la tabla lo muestra como Cancelado. */
  const figuraCancelado = !recurrente && cargadas > 0 && impagas === 0;

  const [agregarMeses, setAgregarMeses] = useState("");
  /**
   * Dónde van los meses que se agregan. No es un detalle: si el préstamo entró
   * recortado, las que faltan ya se pagaron y van ANTES; si se estiró, vienen
   * después. Puestas del lado equivocado, las fechas quedan corridas un año.
   */
  const [dondeAgregar, setDondeAgregar] = useState<"final" | "inicio">("final");
  const [desmarcarUltima, setDesmarcarUltima] = useState(false);
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
  const nMeses = Number.parseInt(agregarMeses, 10);
  const aAgregar =
    Number.isInteger(nMeses) && nMeses > 0
      ? dondeAgregar === "inicio"
        ? mesesAlInicio(cuotas, nMeses)
        : mesesAlFinal(cuotas, nMeses)
      : [];

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
    if (recurrente && !diaMes.trim()) {
      setError("Indicá qué día del mes vence.");
      return;
    }
    if (rehacerAbierto && !planNuevo) {
      setError("Revisá los números del cronograma: cuántas cuotas son, por cuál va y cuándo vence.");
      return;
    }
    if (!rehacerAbierto && agregarMeses.trim() !== "" && aAgregar.length === 0) {
      setError(
        cargadas === 0
          ? "El préstamo no tiene ninguna cuota cargada: usá «Rehacer el cronograma»."
          : "Indicá cuántos meses agregar (un número entero mayor a cero).",
      );
      return;
    }
    setLoading(true);
    setError(null);

    // La ficha primero: si cambió el importe, las cuotas nuevas tienen que
    // salir con el valor nuevo, no con el viejo.
    const res = await updatePrestamoAction(prestamo.id, {
      banco,
      detalle: detalle.trim() || null,
      referencia: referencia.trim() || null,
      tasa: tasa.trim() === "" ? null : Number(tasa),
      importe_cuota: importeNum,
      moneda,
      datos_faltantes: falta.trim() || null,
      cuota_variable: variable,
      es_recurrente: recurrente,
      dia_vencimiento: recurrente && diaMes.trim() !== "" ? Number(diaMes) : null,
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
    } else if (aAgregar.length > 0) {
      const r = await agregarCuotasAction(prestamo.id, {
        meses: aAgregar.length,
        donde: dondeAgregar,
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
      <DialogContent className="gap-0 p-6 sm:max-w-[940px]">
        <DialogHeader className="-mx-6 border-b border-border px-6 pb-4 pt-1">
          {/* pr-8: el título no tiene que meterse debajo de la X. */}
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
                {recurrente
                  ? "Pago mensual sin fecha de fin. "
                  : figuraCancelado
                    ? cargadas === 1
                      ? "Su única cuota figura pagada. "
                      : `Las ${cargadas} cuotas figuran pagadas. `
                    : `Cuota ${pagadas + 1} de ${cargadas || prestamo.cuotas_total}. `}
                Cambiar el importe lo aplica a las cuotas que faltan pagar; las ya pagadas quedan
                como están.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-5">
          {error && (
            <p className="border-l-2 border-[#B91C1C] pl-3 text-sm text-[#B91C1C]">{error}</p>
          )}

          {/* Lo que quedaba pendiente, tachándose en vivo: cuando el usuario
              escribe el importe, ese renglón se marca y al guardar el aviso
              desaparece solo — no hay que borrar ninguna nota a mano. */}
          {marcasIniciales.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1 rounded-[6px] border border-border px-3 py-2">
              {marcasIniciales.map((f) => {
                const listo = !siguePendiente(f, enElFormulario);
                return (
                  <li
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
                  </li>
                );
              })}
            </ul>
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
                    Monto del préstamo{" "}
                    <span className="font-normal text-muted-foreground/70">
                      (dejalo vacío si no lo tenés)
                    </span>
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
                    (opcional — cómo lo llaman en la planilla)
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
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Tasa % <span className="font-normal text-muted-foreground/70">(opc.)</span>
                  </Label>
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

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Qué falta cargar{" "}
                  <span className="font-normal text-muted-foreground/70">
                    (sólo lo que el sistema no puede ver)
                  </span>
                </Label>
                <textarea
                  value={falta}
                  onChange={(e) => setFalta(e.target.value)}
                  rows={2}
                  placeholder="Ej: si es un pago único o parte de un plan"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </section>

            {/* -------------------------- Cronograma ------------------------- */}
            <section className="space-y-3">
              <TituloBloque>Cómo se paga</TituloBloque>

              {/* Pagos que no son un préstamo con N cuotas sino una obligación
                  mensual sin fin, como el plan de ARCA. */}
              <div className="space-y-2.5 rounded-[6px] border border-border px-3 py-2.5">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={variable}
                    onChange={(e) => setVariable(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-[#0088D1]"
                  />
                  <span className="text-[12px] leading-snug">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <TrendingUp size={12} className="text-primary" /> La cuota cambia mes a mes
                    </span>
                    <span className="block text-muted-foreground">
                      Tasa variable. El importe de arriba se toma como el último conocido y la
                      tabla muestra cuánto se movió; la deuda total pasa a ser una estimación.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={recurrente}
                    onChange={(e) => setRecurrente(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-[#0088D1]"
                  />
                  <span className="text-[12px] leading-snug">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <Repeat size={12} className="text-primary" /> Se paga todos los meses
                    </span>
                    <span className="block text-muted-foreground">
                      Sin fecha de fin, como el plan de ARCA. El sistema agenda el vencimiento mes
                      a mes y no le calcula una deuda total.
                    </span>
                  </span>
                </label>
                {recurrente && (
                  <div className="flex items-center gap-2 pl-[22px]">
                    <Label className="text-xs text-muted-foreground">Vence el día</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={diaMes}
                      onChange={(e) => setDiaMes(e.target.value)}
                      placeholder="16"
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">de cada mes</span>
                  </div>
                )}
              </div>

              {!recurrente && (
                <>
                  <TituloBloque>Cuotas</TituloBloque>
                  <div className="space-y-3 rounded-[6px] border border-border px-3 py-2.5">
                    <p className="text-[12px] text-foreground">
                      {cargadas === 0 ? (
                        <span className="text-[#B45309]">No tiene ninguna cuota cargada.</span>
                      ) : (
                        <>
                          <b className="tabular-nums">{cargadas}</b> cuota
                          {cargadas !== 1 ? "s" : ""} cargada{cargadas !== 1 ? "s" : ""} ·{" "}
                          <b className="tabular-nums">{pagadas}</b> pagada
                          {pagadas !== 1 ? "s" : ""}
                          {prestamo.proxima ? (
                            <>
                              {" "}
                              · próxima el{" "}
                              <b>{fmtFecha(prestamo.proxima.fecha_vencimiento)}</b>
                            </>
                          ) : null}
                        </>
                      )}
                    </p>

                    {/* El motivo real de que un préstamo vivo desaparezca de los
                        vencimientos: quedó sin ninguna cuota impaga y la tabla
                        lo da por terminado. Se dice por qué y se arregla acá. */}
                    {figuraCancelado && !rehacerAbierto && (
                      <div className="border-l-2 border-[#B45309] pl-3">
                        <p className="text-[12px] leading-snug text-[#B45309]">
                          Figura como <b>Cancelado</b> porque no le queda ninguna cuota por pagar.
                          Si todavía falta una, destildala acá y vuelve a aparecer en los
                          vencimientos.
                        </p>
                        {ultimaPagada && (
                          <label className="mt-1.5 flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={desmarcarUltima}
                              onChange={(e) => setDesmarcarUltima(e.target.checked)}
                              className="mt-0.5 size-3.5 accent-[#0088D1]"
                            />
                            <span className="text-[12px] leading-snug text-foreground">
                              La cuota {ultimaPagada.nro} (
                              {fmtFecha(ultimaPagada.fecha_vencimiento)}) todavía no está pagada
                            </span>
                          </label>
                        )}
                      </div>
                    )}

                    {/* Agregar meses: el préstamo que se estiró, o el que entró
                        recortado y en verdad tiene más cuotas atrás. */}
                    {!rehacerAbierto && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <CalendarPlus size={13} className="text-primary" /> Agregar meses
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={agregarMeses}
                            onChange={(e) => setAgregarMeses(e.target.value)}
                            placeholder="Ej: 11"
                            className="h-8 w-20"
                            disabled={cargadas === 0}
                          />
                          {cargadas > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              → serían {cargadas + Math.max(aAgregar.length, 0)} en total
                            </span>
                          )}
                        </div>

                        {/* La pregunta que decide todo: si van antes o después.
                            Un préstamo cargado como "1 de 1" que es 12 de 12
                            tiene las once que faltan ATRÁS, ya pagadas. */}
                        <div className="inline-flex overflow-hidden rounded-[6px] border border-border">
                          {(
                            [
                              { id: "inicio", label: "Ya se pagaron" },
                              { id: "final", label: "Vienen después" },
                            ] as const
                          ).map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setDondeAgregar(o.id)}
                              aria-pressed={dondeAgregar === o.id}
                              disabled={cargadas === 0}
                              className={`h-7 px-2.5 text-[11px] font-medium transition-colors ${
                                dondeAgregar === o.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>

                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {aAgregar.length > 0 ? (
                            dondeAgregar === "inicio" ? (
                              <>
                                Se agregan <b className="text-foreground">{aAgregar.length}</b>{" "}
                                cuota{aAgregar.length !== 1 ? "s" : ""} ya pagada
                                {aAgregar.length !== 1 ? "s" : ""}, de{" "}
                                {fmtFecha(aAgregar[0]!.fecha_vencimiento)} a{" "}
                                {fmtFecha(aAgregar.at(-1)!.fecha_vencimiento)}. La cuota que ya
                                estaba pasa a ser la {cargadas + aAgregar.length} de{" "}
                                {cargadas + aAgregar.length}.
                              </>
                            ) : (
                              <>
                                Se agregan <b className="text-foreground">{aAgregar.length}</b>{" "}
                                cuota{aAgregar.length !== 1 ? "s" : ""} sin pagar, de{" "}
                                {fmtFecha(aAgregar[0]!.fecha_vencimiento)} a{" "}
                                {fmtFecha(aAgregar.at(-1)!.fecha_vencimiento)}
                                {importeNum > 0 ? <> · {ars(importeNum)} cada una</> : null}.
                              </>
                            )
                          ) : cargadas === 0 ? (
                            "Primero hay que armar el cronograma."
                          ) : (
                            "Una cuota por mes, con el importe de arriba. «Ya se pagaron» las mete antes de la primera (el préstamo que entró recortado); «Vienen después» las agenda a partir de la última."
                          )}
                        </p>
                      </div>
                    )}

                    {/* Cuando lo que falta está en el PASADO, agregar al final no
                        sirve: hay que rearmar el calendario entero. */}
                    {!rehacerAbierto ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRehacerAbierto(true);
                          setAgregarMeses("");
                          setDesmarcarUltima(false);
                        }}
                        className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
                      >
                        ¿Los números no coinciden? Rehacer el cronograma
                      </button>
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
                        <p className="border-l-2 border-[#B45309] pl-3 text-[11px] leading-snug text-[#B45309]">
                          Vuelve a armar TODAS las cuotas, una por mes. Se pierden las fechas que
                          hayas corregido cuota por cuota. Los importes ya cargados se conservan.
                        </p>
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
                              placeholder="12"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                              Próxima cuota Nº
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              value={rProxima}
                              onChange={(e) => setRProxima(e.target.value)}
                              placeholder="12"
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
                                <> Se borran {cargadas - planNuevo.length} cuotas del final.</>
                              ) : null}
                            </>
                          ) : (
                            "Cuántas cuotas son en total, por cuál va y cuándo vence esa. Las anteriores quedan pagadas."
                          )}
                        </p>
                      </div>
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
