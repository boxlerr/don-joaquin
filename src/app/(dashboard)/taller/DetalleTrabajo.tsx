"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Truck, User, Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TrabajoFeed } from "./actions";

/**
 * El detalle de un trabajo cargado.
 *
 * En la lista sólo entran dos renglones y la foto en miniatura; acá se ve la
 * foto entera y el mensaje completo, que es lo que hace falta para saber qué se
 * hizo. Y dice **dónde quedó guardado**: un registro que no se sabe dónde vive
 * es un registro en el que no se confía.
 */

/** "24/08/2026 a las 16:29" — la hora importa: es lo que permite reconocer el mensaje. */
function cuando(fecha: string, cargadoEn: string | null): string {
  const [y, m, d] = fecha.slice(0, 10).split("-");
  const base = `${d}/${m}/${y}`;
  if (!cargadoEn) return base;
  const dt = new Date(cargadoEn);
  if (Number.isNaN(dt.getTime())) return base;
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${base} a las ${hh}:${mm}`;
}

/**
 * Qué mostrar cuando la fila no trae texto.
 *
 * Las roturas cargadas desde Mantenimiento antes de que existiera esta pantalla
 * no tienen observaciones: en la lista se veían como una tarjeta vacía con sólo
 * una fecha. Se arma una frase con lo que sí tienen.
 */
export function descripcionDe(t: TrabajoFeed): string {
  if (t.texto.trim()) return t.texto;
  const partes = [
    t.tipo ? t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1) : null,
    t.marca,
    t.posicion ? `posición ${t.posicion}` : null,
    t.cantidad && t.cantidad > 1 ? `${t.cantidad} unidades` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sin detalle cargado";
}

export default function DetalleTrabajo({
  trabajo,
  onCerrar,
}: {
  trabajo: TrabajoFeed | null;
  onCerrar: () => void;
}) {
  return (
    <Sheet open={trabajo !== null} onOpenChange={(v) => !v && onCerrar()}>
      <SheetContent side="bottom" className="p-0">
        {trabajo && (
          <>
            <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
              <SheetTitle className="text-base">
                {cuando(trabajo.fecha, trabajo.cargadoEn)}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-4 overflow-y-auto px-4 pb-8 pt-4">
              {trabajo.fotos.length > 0 && (
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
                  {trabajo.fotos.map((f) => (
                    <Image
                      key={f}
                      src={f}
                      alt=""
                      width={600}
                      height={600}
                      unoptimized
                      className="h-56 w-auto shrink-0 rounded-xl border border-border object-cover"
                    />
                  ))}
                </div>
              )}

              <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
                {descripcionDe(trabajo)}
              </p>

              <div className="flex flex-wrap gap-2">
                {trabajo.patente && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground">
                    <Truck size={14} />
                    {trabajo.patente}
                  </span>
                )}
                {trabajo.persona && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground">
                    <User size={14} />
                    {trabajo.persona}
                  </span>
                )}
              </div>

              {trabajo.quien && (
                <p className="text-sm text-muted-foreground">Lo cargó {trabajo.quien}.</p>
              )}

              {/* Dónde quedó. Es la pregunta que se hace cualquiera la primera
                  vez que carga algo en un sistema nuevo. */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Wrench size={14} className="text-muted-foreground" />
                  Dónde quedó guardado
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  En Mantenimiento, junto con el resto de las roturas y reparaciones. Desde ahí se
                  le puede poner el costo y el repuesto que se usó.
                </p>
                {/* Al trabajo exacto, ya desplegado: mandar a la pantalla y
                    que la persona lo busque entre 200 filas es no mandarla. */}
                <Link
                  href={`/mantenimiento?tab=roturas&rotura=${trabajo.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Abrir Mantenimiento
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
