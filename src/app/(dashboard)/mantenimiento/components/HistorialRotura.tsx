"use client";

import { useEffect, useState } from "react";
import { ChevronDown, PencilLine } from "lucide-react";
import { getHistorialRoturaAction, type EdicionRotura } from "../actions";

/**
 * Qué se le tocó a un registro después de cargarlo.
 *
 * Pedido de Julián (27/08): *"si se edita que aparezca que fue editado con lo
 * que decía antes para poder auditar cualquier edit a posta que se haga"*.
 *
 * La idea es simple y vale la pena decirla: **editar se puede, editar sin que
 * se note no**. El taller carga desde el teléfono, con la unidad arriba del
 * elevador, y una palabra mal escrita tiene que poder arreglarse. Lo que no
 * puede pasar es que un registro cambie de contenido y quede como si siempre
 * hubiera dicho eso. Por eso lo que decía antes queda a la vista de cualquiera
 * que abra el trabajo, no escondido en una tabla de la base.
 *
 * Cuando no se editó nada, este bloque no existe: un cartel que dice "sin
 * ediciones" en cada registro es ruido en las 200 filas que nadie tocó.
 */

function cuando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} a las ${hh}:${mi}`;
}

/** Una línea que dice qué pasó, en el idioma en que lo contaría una persona. */
function queHizo(e: EdicionRotura): string {
  if (e.accion === "foto_agregada") {
    const n = e.archivos.length;
    return n > 1 ? `Agregó ${n} fotos` : "Agregó una foto";
  }
  if (e.accion === "foto_eliminada") return "Borró una foto";
  return "Corrigió lo que decía";
}

export default function HistorialRotura({
  roturaId,
  /** Cambiá este número para que vuelva a preguntar (después de editar). */
  refrescar = 0,
}: {
  roturaId: string;
  refrescar?: number;
}) {
  const [ediciones, setEdiciones] = useState<EdicionRotura[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    getHistorialRoturaAction(roturaId)
      .then((h) => !cancelado && setEdiciones(h))
      .catch(() => !cancelado && setEdiciones([]));
    return () => {
      cancelado = true;
    };
  }, [roturaId, refrescar]);

  if (ediciones.length === 0) return null;

  const ultima = ediciones[0];

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3.5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <PencilLine size={14} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          Editado {ediciones.length > 1 ? `${ediciones.length} veces` : ""}
          <span className="ml-1 font-normal text-muted-foreground">
            · {ultima.quien ? `${ultima.quien}, ` : ""}
            {cuando(ultima.cuando)}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <ol className="mt-3 space-y-3 border-t border-border pt-3">
          {ediciones.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="text-foreground">
                {queHizo(e)}
                <span className="text-muted-foreground">
                  {" · "}
                  {e.quien ?? "alguien"}, {cuando(e.cuando)}
                </span>
              </p>

              {/* Lo que decía antes, textual. Es el punto de todo el bloque:
                  sin el texto viejo, saber que "se editó" no sirve de nada. */}
              {e.accion === "actualizar" && e.textoAnterior && (
                <p className="mt-1 border-l-2 border-border pl-2.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">
                  Antes decía: {e.textoAnterior}
                </p>
              )}
              {e.archivos.length > 0 && (
                <p className="mt-1 truncate text-[13px] text-muted-foreground">
                  {e.archivos.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
