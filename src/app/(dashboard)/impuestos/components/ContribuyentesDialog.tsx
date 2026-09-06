"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Lock, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import InlineFeedback from "@/components/ui/InlineFeedback";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  COLUMNAS_AVISO,
  COLUMNA_IMPUESTOS_EMPRESA,
  COLUMNA_IMPUESTOS_PERSONALES,
  avisaA,
  cuitDigitoOk,
  esReservado,
  normalizarCuit,
} from "@/domain/impuestos/entidades";
import {
  actualizarContribuyenteAction,
  crearContribuyenteAction,
  eliminarContribuyenteAction,
  getContribuyentesAdminAction,
} from "../contribuyentes-actions";
import type { ContribuyenteAdmin } from "../contribuyentes-tipos";

/**
 * Alta, edición y baja de contribuyentes — el catálogo detrás del desplegable.
 *
 * Se abre desde el propio desplegable ("Administrar contribuyentes"), que era
 * donde se lo buscaba: la lista se veía, no se tocaba. Pedido de Julián, 03/09.
 *
 * Tres decisiones que no son de forma:
 *
 *  · **El código interno no se edita.** Es la clave que quedó escrita en cada
 *    vencimiento; cambiarlo dejaría 26 filas apuntando a nadie. Se calcula solo
 *    al dar de alta y no se muestra.
 *  · **Con vencimientos cargados no se borra.** Detrás de cada uno hay importes,
 *    fechas de pago y comprobantes escaneados. El botón queda apagado y dice
 *    cuántos hay, en vez de ofrecer un borrado en cascada que nadie puede deshacer.
 *  · **Cambiar "a quién le avisa" se avisa en pantalla**, porque es lo único que
 *    separa un calendario que ve todo el equipo de uno que ven tres personas.
 */

const VACIO = { nombre: "", cuit: "", columnaAlerta: COLUMNA_IMPUESTOS_EMPRESA };

type Modo =
  | { t: "lista" }
  | { t: "nuevo" }
  | { t: "editar"; item: ContribuyenteAdmin };

export default function ContribuyentesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ContribuyenteAdmin[]>([]);
  const [puedePersonales, setPuedePersonales] = useState(false);
  const [puedeVerPersonales, setPuedeVerPersonales] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<Modo>({ t: "lista" });
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Fila con el "¿seguro?" desplegado. Se confirma en la misma línea: un
   *  diálogo arriba de otro deja el teclado atrapado en la capa de abajo. */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  // Todos los `setState` van DESPUÉS del await a propósito: hacerlos en el
  // cuerpo del efecto encadena renders y lo marca el lint de React.
  const cargar = useCallback(async () => {
    const res = await getContribuyentesAdminAction();
    setItems(res.items);
    setPuedePersonales(res.puedePersonales);
    setPuedeVerPersonales(res.puedeVerPersonales);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    getContribuyentesAdminAction()
      .then((res) => {
        if (!vivo) return;
        setItems(res.items);
        setPuedePersonales(res.puedePersonales);
        setPuedeVerPersonales(res.puedeVerPersonales);
        setCargando(false);
      })
      .catch(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [open]);

  /** El diálogo se limpia al cerrarse, no al abrirse: así la próxima vez que se
   *  abre ya arranca en la lista y sin el error de la vez pasada colgado. */
  const cerrar = () => {
    setModo({ t: "lista" });
    setError(null);
    setConfirmando(null);
    setCargando(true);
    onOpenChange(false);
  };

  const abrirNuevo = () => {
    setForm(VACIO);
    setError(null);
    setModo({ t: "nuevo" });
  };

  const abrirEdicion = (item: ContribuyenteAdmin) => {
    setForm({ nombre: item.nombre, cuit: item.cuit, columnaAlerta: item.columnaAlerta });
    setError(null);
    setModo({ t: "editar", item });
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const res =
      modo.t === "editar"
        ? await actualizarContribuyenteAction(modo.item.codigo, form)
        : await crearContribuyenteAction(form);
    setGuardando(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setModo({ t: "lista" });
    await cargar();
    // La pantalla de atrás tiene su propia copia de la lista (el filtro, el
    // formulario de carga y el nombre en cada fila): sin esto sigue mostrando
    // el nombre viejo hasta que alguien recargue.
    router.refresh();
  };

  const eliminar = async (item: ContribuyenteAdmin) => {
    setBorrando(item.codigo);
    setError(null);
    const res = await eliminarContribuyenteAction(item.codigo);
    setBorrando(null);
    setConfirmando(null);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    await cargar();
    router.refresh();
  };

  const cuitNormalizado = normalizarCuit(form.cuit);
  const nombreOk = form.nombre.trim().length >= 2;
  const puedeGuardar = nombreOk && cuitNormalizado !== null && !guardando;
  // El dígito verificador no bloquea —el CUIT se carga como dice el papel—, pero
  // se dice: mal tipeado, el PDF del estudio no matchea con nadie el mes que viene.
  const dvSospechoso = cuitNormalizado !== null && !cuitDigitoOk(cuitNormalizado);

  const cambiaAudiencia =
    modo.t === "editar" && modo.item.columnaAlerta !== form.columnaAlerta;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : cerrar())}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground">
            {modo.t === "nuevo"
              ? "Agregar contribuyente"
              : modo.t === "editar"
                ? "Editar contribuyente"
                : "Contribuyentes"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {modo.t === "lista"
              ? "De quién es cada vencimiento del calendario. El CUIT es con el que se reconoce el PDF que manda el estudio."
              : "El CUIT identifica el calendario del estudio, y «a quién le avisa» decide quién recibe los correos."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <InlineFeedback
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
            autoHideMs={0}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {modo.t === "lista" ? (
          <div className="space-y-3 py-1">
            {cargando ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Cargando…
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Todavía no hay contribuyentes cargados.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((it) => {
                  const bloqueado = it.vencimientos > 0;
                  return (
                    <li key={it.codigo} className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {it.nombre}
                            </span>
                            {esReservado(it.columnaAlerta) && (
                              <span
                                className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground"
                                title={avisaA(it.columnaAlerta)}
                              >
                                <Lock size={11} /> Reservado
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            <span className="tabular-nums">{it.cuit}</span>
                            {" · "}
                            {it.vencimientos === 0
                              ? "sin vencimientos"
                              : `${it.vencimientos} vencimiento${it.vencimientos === 1 ? "" : "s"}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => abrirEdicion(it)}
                            aria-label={`Editar ${it.nombre}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          {/* El title va en el envoltorio y no en el botón: un
                              botón deshabilitado no recibe eventos de mouse, así
                              que el tooltip nunca aparecía justo cuando hacía falta. */}
                          <span
                            title={
                              bloqueado
                                ? `Tiene ${it.vencimientos} vencimiento${it.vencimientos === 1 ? "" : "s"} agendado${it.vencimientos === 1 ? "" : "s"}. Borralos primero: con ellos se irían los importes, las fechas de pago y los comprobantes.`
                                : undefined
                            }
                            className="inline-flex"
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={bloqueado || borrando !== null}
                              onClick={() => setConfirmando(it.codigo)}
                              aria-label={`Eliminar ${it.nombre}`}
                              className={bloqueado ? undefined : "text-[#EF4444] hover:text-[#DC2626]"}
                            >
                              {borrando === it.codigo ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </Button>
                          </span>
                        </div>
                      </div>

                      {/* La confirmación va en la misma fila, no en otro diálogo. */}
                      {confirmando === it.codigo && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2">
                          <span className="text-xs text-foreground">
                            ¿Eliminar «{it.nombre}»? No se puede deshacer.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmando(null)}
                              disabled={borrando !== null}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => eliminar(it)}
                              disabled={borrando !== null}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!puedeVerPersonales && (
              <p className="text-xs text-muted-foreground">
                Los contribuyentes personales no aparecen acá: hacen falta permisos de
                «Impuestos personales».
              </p>
            )}
          </div>
        ) : (
          /* ---------------------------------------------------------------- */
          <div
            className="space-y-4 py-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && puedeGuardar) guardar();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cont-nombre" className="text-sm font-medium text-foreground">
                Contribuyente
              </Label>
              <Input
                id="cont-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Joaquín Hnos S.R.L."
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cont-cuit" className="text-sm font-medium text-foreground">
                CUIT
              </Label>
              <Input
                id="cont-cuit"
                value={form.cuit}
                onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
                onBlur={() =>
                  setForm((f) => ({ ...f, cuit: normalizarCuit(f.cuit) ?? f.cuit }))
                }
                placeholder="30-70908728-9"
                inputMode="numeric"
                className="tabular-nums"
              />
              {dvSospechoso ? (
                <p className="flex items-start gap-1.5 text-xs text-[#B45309]">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                  El dígito verificador no cierra. Se puede guardar igual, pero revisalo: si
                  está mal, el calendario que mande el estudio no va a reconocerlo.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Con guiones o los 11 números seguidos, como te quede más cómodo.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">¿A quién le avisa?</Label>
              <Combobox
                value={form.columnaAlerta}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, columnaAlerta: v || COLUMNA_IMPUESTOS_EMPRESA }))
                }
                options={COLUMNAS_AVISO.map((c) => ({
                  id: c.id,
                  label: c.label,
                  disabled: c.id === COLUMNA_IMPUESTOS_PERSONALES && !puedePersonales,
                  hint:
                    c.id === COLUMNA_IMPUESTOS_PERSONALES && !puedePersonales
                      ? "Hacen falta permisos de «Impuestos personales»"
                      : undefined,
                }))}
                aria-label="A quién le avisa"
              />
              {cambiaAudiencia ? (
                <p className="flex items-start gap-1.5 text-xs text-[#B45309]">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                  {esReservado(form.columnaAlerta)
                    ? "Sus vencimientos van a dejar de verse y de avisarle a todo el equipo: van a quedar sólo para quien tenga «Impuestos personales»."
                    : "Sus vencimientos van a pasar a verse y a avisarle a todo el equipo de Impuestos, con el CUIT a la vista."}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{avisaA(form.columnaAlerta)}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {modo.t === "lista" ? (
            <>
              <Button variant="outline" onClick={abrirNuevo} disabled={cargando}>
                <Plus size={14} /> Agregar contribuyente
              </Button>
              <Button variant="brand" onClick={cerrar}>
                Listo
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  setModo({ t: "lista" });
                }}
                disabled={guardando}
              >
                Volver
              </Button>
              <Button variant="brand" onClick={guardar} disabled={!puedeGuardar}>
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
                {modo.t === "editar" ? "Guardar cambios" : "Agregar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
