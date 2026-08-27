"use client";

import FotosRotura from "./FotosRotura";
import HistorialRotura from "./HistorialRotura";
import type { RoturaRow } from "../actions";

/**
 * El detalle de una rotura, desplegado dentro de la misma tabla.
 *
 * Pedido de Julián (26/08): *"el detalle de la rotura quiero verla en la misma
 * tabla donde se pueda ver toda la info y las fotos ya ahí desplegado"*. Antes
 * la única forma de ver una rotura entera —y sobre todo sus fotos— era abrir el
 * diálogo de EDICIÓN, que es otra cosa: para mirar no hace falta entrar a
 * modificar, y entrar a modificar para mirar es cómo se rompen los datos.
 *
 * Las fotos las maneja `FotosRotura`, el mismo componente que usa el Taller:
 * se piden recién al desplegar —con 200 roturas en la tabla, traer los adjuntos
 * de todas para mostrar los de una sería pedir 200 URLs firmadas que nadie va a
 * mirar— y tocarlas las abre a pantalla grande, con las flechas para pasar a la
 * siguiente y el botón para bajarlas.
 */

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

export default function RoturaDetalle({
  rotura,
  canWrite = false,
}: {
  rotura: RoturaRow;
  canWrite?: boolean;
}) {
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
          {rotura.unidad_patente ? <span className="font-mono">{rotura.unidad_patente}</span> : "—"}
        </Dato>
      </dl>

      <FotosRotura roturaId={rotura.id} canWrite={canWrite} />

      <HistorialRotura roturaId={rotura.id} />
    </div>
  );
}
