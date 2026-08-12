"use client";

import { Check, FileClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describirCuando } from "@/lib/borrador-local";

/**
 * "Borrador guardado hoy 19:42", chiquito y al costado.
 *
 * Va en las pantallas de carga larga. No es decoración: es lo que le permite a
 * alguien que cargó veinte filas saber que puede levantarse de la silla. Sin
 * esto el autoguardado existe pero nadie se entera, y el miedo a perder el
 * trabajo sigue igual.
 */
export function SelloBorrador({ ts }: { ts: number | null }) {
  if (!ts) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400" role="status">
      <Check size={12} />
      Borrador guardado {describirCuando(ts)}
    </span>
  );
}

/**
 * "Quedó algo cargado de ayer 18:40 — Recuperar / Descartar".
 *
 * Aparece cuando la pantalla encuentra un borrador de una sesión anterior. Dice
 * CUÁNDO se guardó porque es lo único que le permite a la persona reconocer si
 * eso es suyo y de cuándo: "tenés un borrador" a secas no alcanza para decidir.
 *
 * Deliberadamente sobrio y sin color de alarma: no pasó nada malo, se está
 * ofreciendo algo. El que decide es el usuario, nunca la pantalla.
 */
export default function AvisoBorrador({
  ts,
  onRecuperar,
  onDescartar,
  detalle,
}: {
  /** Cuándo se guardó el borrador. */
  ts: number;
  onRecuperar: () => void;
  onDescartar: () => void;
  /** Opcional: "12 filas", "3 choferes" — para saber qué se está por recuperar. */
  detalle?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 sm:flex-row sm:items-center sm:gap-3"
    >
      <FileClock size={16} className="shrink-0 text-slate-400" />
      <p className="flex-1">
        Quedó algo cargado sin guardar de <span className="font-medium">{describirCuando(ts)}</span>
        {detalle ? ` (${detalle})` : ""}.
      </p>
      {/* En celular los botones van a lo ancho: apretados a la derecha no se
          aciertan con el pulgar. */}
      <div className="flex shrink-0 gap-2 max-sm:w-full">
        <Button type="button" size="sm" variant="outline" onClick={onRecuperar} className="max-sm:flex-1">
          Recuperar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDescartar} className="max-sm:flex-1">
          Descartar
        </Button>
      </div>
    </div>
  );
}
