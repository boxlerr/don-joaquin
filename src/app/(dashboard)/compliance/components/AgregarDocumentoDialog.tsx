"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Building2, Truck, Users } from "lucide-react";
import { formatFecha } from "@/lib/utils";
import type { ComplianceEstado, ComplianceEstadoRow, ComplianceRequisito } from "../types";
import CargarComplianceDocDialog, { type EditVencimiento } from "./CargarComplianceDocDialog";

/**
 * "Agregar documento" desde la cabecera: elegís el tipo y de quién es, y recién
 * ahí se abre el formulario de carga de siempre.
 *
 * Antes el único camino era encontrar la fila: bajar al checklist, abrir
 * "Unidades", abrir la unidad y tocar la casilla. Con 848 filas eso es buscar
 * una aguja. Acá se elige de dos listas con buscador, que además ordenan
 * primero lo que falta y avisan si ese documento ya estaba cargado (en ese caso
 * se abre en modo edición y no se duplica).
 */

const ESTADO_NOTA: Record<ComplianceEstado, string> = {
  vencido: "vencido",
  por_vencer: "por vencer",
  faltante: "sin cargar",
  vigente: "al día",
};

const RANK: Record<ComplianceEstado, number> = { vencido: 0, por_vencer: 1, faltante: 2, vigente: 3 };

const NIVEL_ICON = { empresa: Building2, unidad: Truck, chofer: Users } as const;

export default function AgregarDocumentoDialog({
  rows,
  requisitos,
  open,
  onOpenChange,
  onSuccess,
}: {
  rows: ComplianceEstadoRow[];
  requisitos: ComplianceRequisito[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [entidad, setEntidad] = useState("");
  /** Cuando está, se pasó al formulario de carga con esta fila elegida. */
  const [cargando, setCargando] = useState<ComplianceEstadoRow | null>(null);

  const reqPorId = useMemo(() => {
    const m = new Map<string, ComplianceRequisito>();
    for (const r of requisitos) m.set(r.id, r);
    return m;
  }, [requisitos]);

  // Los tipos salen de las filas y no del catálogo: un tipo sin ninguna fila no
  // tiene a quién asignarse.
  const tipos = useMemo(() => {
    const m = new Map<string, { codigo: string; nombre: string; pendientes: number; total: number }>();
    for (const r of rows) {
      const prev = m.get(r.requisito_codigo) ?? {
        codigo: r.requisito_codigo,
        nombre: r.requisito_nombre,
        pendientes: 0,
        total: 0,
      };
      prev.total += 1;
      if (r.estado !== "vigente") prev.pendientes += 1;
      m.set(r.requisito_codigo, prev);
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rows]);

  const filasDelTipo = useMemo(
    () => (codigo ? rows.filter((r) => r.requisito_codigo === codigo) : []),
    [rows, codigo],
  );

  const nivel = filasDelTipo[0]?.nivel ?? null;

  const opcionesEntidad = useMemo(
    () =>
      [...filasDelTipo]
        .sort((a, b) => {
          const d = RANK[a.estado] - RANK[b.estado];
          if (d !== 0) return d;
          return (a.chofer_nombre ?? a.camion_patente ?? "").localeCompare(
            b.chofer_nombre ?? b.camion_patente ?? "",
          );
        })
        .map((r) => ({
          id: r.chofer_id ?? r.camion_id ?? "empresa",
          label: r.chofer_nombre ?? r.camion_patente ?? "Empresa",
          note: ESTADO_NOTA[r.estado],
        })),
    [filasDelTipo],
  );

  // Con nivel "empresa" hay una sola fila y no hay nada que elegir.
  const filaElegida =
    nivel === "empresa"
      ? filasDelTipo[0] ?? null
      : filasDelTipo.find((r) => (r.chofer_id ?? r.camion_id) === entidad) ?? null;

  const requisito = filaElegida ? reqPorId.get(filaElegida.requisito_id) ?? null : null;

  const cerrar = () => {
    setCodigo("");
    setEntidad("");
    onOpenChange(false);
  };

  // OJO: acá NO se avisa `onOpenChange(false)`. El padre monta este diálogo con
  // `{agregando && <AgregarDocumentoDialog…>}`, así que cerrar el paso 1 desde
  // afuera desmontaba el componente entero — y con él el formulario de carga que
  // se acababa de pedir. El efecto era que "Continuar" cerraba todo y no se
  // llegaba nunca a la pantalla para subir el papel. El paso 1 se tapa solo
  // (`open && !cargando`) y el padre se entera recién cuando termina el flujo.
  const continuar = () => {
    if (!filaElegida || !requisito) return;
    setCargando(filaElegida);
  };

  /** Se cerró el formulario de carga: termina el flujo entero. */
  const terminar = () => {
    setCargando(null);
    setCodigo("");
    setEntidad("");
    onOpenChange(false);
  };

  const edit: EditVencimiento | undefined =
    cargando?.documento_id && cargando.documento_fuente
      ? {
          documento_id: cargando.documento_id,
          fuente: cargando.documento_fuente as EditVencimiento["fuente"],
          fecha_vencimiento: cargando.fecha_vencimiento,
          observaciones: cargando.observaciones ?? null,
        }
      : undefined;

  const reqDeCarga = cargando ? reqPorId.get(cargando.requisito_id) ?? null : null;
  const Icono = nivel ? NIVEL_ICON[nivel] : null;

  return (
    <>
      <Dialog open={open && !cargando} onOpenChange={(v) => (v ? onOpenChange(true) : cerrar())}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground sm:text-xl">Agregar documento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Elegí qué documento es y de quién. Si ya estaba cargado se abre para actualizarle el
              vencimiento, así no queda duplicado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">1. ¿Qué documento?</Label>
              <Combobox
                value={codigo}
                onValueChange={(v) => {
                  setCodigo(v);
                  setEntidad("");
                }}
                options={tipos.map((t) => ({
                  id: t.codigo,
                  label: t.nombre,
                  note:
                    t.pendientes > 0
                      ? `${t.pendientes} pendiente${t.pendientes === 1 ? "" : "s"}`
                      : undefined,
                }))}
                placeholder="Elegí el tipo de documento…"
                searchPlaceholder="Buscar tipo…"
                aria-label="Tipo de documento"
              />
            </div>

            {nivel && nivel !== "empresa" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  2. ¿De qué {nivel === "unidad" ? "unidad" : "chofer"}?
                </Label>
                <Combobox
                  value={entidad}
                  onValueChange={setEntidad}
                  options={opcionesEntidad}
                  placeholder={nivel === "unidad" ? "Elegí la unidad…" : "Elegí el chofer…"}
                  searchPlaceholder={nivel === "unidad" ? "Buscar patente…" : "Buscar chofer…"}
                  aria-label={nivel === "unidad" ? "Unidad" : "Chofer"}
                />
                <p className="text-[11px] text-muted-foreground">
                  Arriba de la lista van los que tienen algo pendiente.
                </p>
              </div>
            )}

            {nivel === "empresa" && (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                {Icono && <Icono size={14} className="shrink-0" aria-hidden />}
                Es un documento de la empresa: se presenta una sola vez para toda la flota.
              </p>
            )}

            {filaElegida && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[12px]">
                <p className="font-medium text-foreground">
                  Estado hoy: {ESTADO_NOTA[filaElegida.estado]}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {filaElegida.fecha_vencimiento
                    ? `Vence el ${formatFecha(filaElegida.fecha_vencimiento)}.`
                    : "Nunca se cargó."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={cerrar} className="border-border text-muted-foreground">
              Cancelar
            </Button>
            {/* También pide `requisito`: sin él `continuar()` se vuelve sin hacer
                nada, y un botón habilitado que no responde se lee como que el
                sistema se colgó. */}
            <Button
              type="button"
              variant="brand"
              onClick={continuar}
              disabled={!filaElegida || !requisito}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cargando && reqDeCarga && (
        <CargarComplianceDocDialog
          requisito={reqDeCarga}
          chofer_id={cargando.chofer_id ?? undefined}
          camion_id={cargando.camion_id ?? undefined}
          entidadLabel={cargando.chofer_nombre ?? cargando.camion_patente ?? null}
          edit={edit}
          open={true}
          onOpenChange={(o) => {
            if (!o) terminar();
          }}
          onSuccess={() => {
            setCargando(null);
            setCodigo("");
            setEntidad("");
            onSuccess();
          }}
        />
      )}
    </>
  );
}
