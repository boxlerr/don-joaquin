"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { getArchivosRoturaAction, type AdjuntoArchivo, type RoturaRow } from "../actions";

/**
 * El detalle de una rotura, desplegado dentro de la misma tabla.
 *
 * Pedido de Julián (26/08): *"el detalle de la rotura quiero verla en la misma
 * tabla donde se pueda ver toda la info y las fotos ya ahí desplegado"*. Antes
 * la única forma de ver una rotura entera —y sobre todo sus fotos— era abrir el
 * diálogo de EDICIÓN, que es otra cosa: para mirar no hace falta entrar a
 * modificar, y entrar a modificar para mirar es cómo se rompen los datos.
 *
 * Las fotos se piden recién al desplegar. Con 200 roturas en la tabla, traer
 * los adjuntos de todas para mostrar los de una sería pedir 200 URLs firmadas
 * que nadie va a mirar.
 */

const ES_IMAGEN = /^image\//;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function RoturaDetalle({ rotura }: { rotura: RoturaRow }) {
  // `null` = todavía no contestó. Si falla, queda en lista vacía: un spinner
  // eterno haría pensar que la foto está por aparecer cuando no va a aparecer.
  const [archivos, setArchivos] = useState<AdjuntoArchivo[] | null>(null);
  const cargando = archivos === null;

  useEffect(() => {
    let cancelado = false;
    getArchivosRoturaAction(rotura.id)
      .then((a) => {
        if (!cancelado) setArchivos(a);
      })
      .catch(() => {
        if (!cancelado) setArchivos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [rotura.id]);

  const fotos = (archivos ?? []).filter((a) => ES_IMAGEN.test(a.mime_type ?? ""));
  const otros = (archivos ?? []).filter((a) => !ES_IMAGEN.test(a.mime_type ?? ""));

  return (
    <div className="space-y-4 bg-muted/20 px-4 py-4 lg:px-6">
      {/* El texto entero y arriba: en la columna "Detalle" de la tabla entra
          cortado, y es lo que escribió la persona que hizo el trabajo. */}
      {rotura.observaciones && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {rotura.observaciones}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dato etiqueta="Qué se rompió">{rotura.tipo || "—"}</Dato>
        <Dato etiqueta="Gravedad">{rotura.gravedad === "grave" ? "Grave" : "Leve"}</Dato>
        <Dato etiqueta="Marca">{rotura.marca || "—"}</Dato>
        <Dato etiqueta="Posición">{rotura.posicion || "—"}</Dato>
        <Dato etiqueta="Estado de uso">{rotura.estado_uso || "—"}</Dato>
        <Dato etiqueta="Cantidad">{rotura.cantidad ?? 1}</Dato>
        <Dato etiqueta="Costo">
          {rotura.costo != null ? `$ ${Math.round(rotura.costo).toLocaleString("es-AR")}` : "—"}
        </Dato>
        <Dato etiqueta="Unidad">
          {rotura.unidad_patente ? (
            <span className="font-mono">{rotura.unidad_patente}</span>
          ) : (
            "—"
          )}
        </Dato>
      </dl>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Paperclip size={12} />
          Fotos y comprobantes
        </p>
        {cargando ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Buscando los archivos…
          </p>
        ) : (archivos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No se cargó ninguna foto.</p>
        ) : (
          <>
            {fotos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {fotos.map((a) => (
                  // Se abre en una pestaña porque la URL está firmada y vence:
                  // guardar el link no sirve, hay que verla ahora.
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="shrink-0">
                    <Image
                      src={a.url}
                      alt={a.nombre_original}
                      width={320}
                      height={320}
                      unoptimized
                      className="h-40 w-auto rounded-lg border border-border object-cover transition-opacity hover:opacity-90"
                    />
                  </a>
                ))}
              </div>
            )}
            {otros.length > 0 && (
              <ul className="mt-2 space-y-1">
                {otros.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <FileText size={13} />
                      {a.nombre_original}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
