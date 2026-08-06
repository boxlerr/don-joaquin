"use client";

// Dónde vive el personal — antes era un gráfico de barras de 200px de alto (más
// título, más marco: ~300px de pantalla) para decir doce números.
//
// Se cambió por una tira de una línea. El motivo no es sólo el espacio: el
// gráfico ordenaba por cantidad y por eso la barra más alta era siempre
// "Sin datos" —los 14 legajos a los que les falta la localidad—, que no es una
// localidad ni se puede comparar contra Azul. Acá eso sale del ranking y pasa a
// ser lo que en realidad es: un pendiente de carga, a la derecha y clickeable
// para ir a arreglarlo.
//
// Lo que el gráfico servía para hacer (tocar una barra y ver quiénes son) sigue
// igual: se toca la localidad y se abre la lista.

import { useState } from "react";
import Link from "next/link";
import { MapPin, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import AvatarPersona from "@/components/ui/AvatarPersona";
import { choferSlug } from "@/lib/chofer-slug";

export type ChoferLocalidad = {
  id: string;
  nombre: string;
  apellido: string;
  estado: string;
  rol: string | null;
};

export type LocalidadData = {
  localidad: string;
  cantidad: number;
  choferes: ChoferLocalidad[];
};

/** Cuántas localidades entran en la línea antes de plegar el resto. */
const VISIBLES = 5;

export default function ChoferesLocalidades({
  localidades,
  sinLocalidad,
}: {
  localidades: LocalidadData[];
  sinLocalidad: ChoferLocalidad[];
}) {
  const [selected, setSelected] = useState<LocalidadData | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  if (localidades.length === 0 && sinLocalidad.length === 0) return null;

  const visibles = verTodas ? localidades : localidades.slice(0, VISIBLES);
  const ocultas = localidades.length - visibles.length;

  const sinLocalidadData: LocalidadData = {
    localidad: "Sin localidad cargada",
    cantidad: sinLocalidad.length,
    choferes: sinLocalidad,
  };

  return (
    <div className="mb-4 sm:mb-6 rounded-[8px] border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex shrink-0 items-center gap-2">
          <MapPin size={15} className="text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Dónde vive el personal</span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
          {visibles.map((l, i) => (
            <span key={l.localidad} className="flex items-center">
              {i > 0 && <span className="mx-1 text-border select-none">·</span>}
              <button
                type="button"
                onClick={() => setSelected(l)}
                className="-mx-1 inline-flex items-baseline gap-1.5 rounded px-1 py-0.5 hover:bg-muted"
                title={`Ver los ${l.cantidad} de ${l.localidad}`}
              >
                <span className="text-xs text-muted-foreground">{l.localidad}</span>
                <span className="text-[13px] font-bold tabular-nums text-primary">{l.cantidad}</span>
              </button>
            </span>
          ))}

          {(ocultas > 0 || verTodas) && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              className="ml-1.5 rounded px-1 py-0.5 text-xs font-medium text-primary hover:bg-muted"
            >
              {verTodas
                ? "Ver menos"
                : `+${ocultas} ${ocultas === 1 ? "localidad" : "localidades"}`}
            </button>
          )}
        </div>

        {/* No es una localidad más: es trabajo pendiente de carga. Va aparte, en
            ámbar y del otro lado, para que no compita en el ranking. */}
        {sinLocalidad.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(sinLocalidadData)}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Ver a quiénes les falta cargar la localidad"
          >
            <TriangleAlert size={13} className="text-[#F59E0B]" />
            <span>
              <span className="font-bold tabular-nums text-[#F59E0B]">{sinLocalidad.length}</span>{" "}
              sin localidad cargada
            </span>
          </button>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-4 border-b border-border">
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm pr-8">
              <MapPin size={15} className="text-primary shrink-0" />
              {selected?.localidad}
              <span className="text-xs font-normal text-muted-foreground">
                {selected?.cantidad} {selected?.cantidad === 1 ? "persona" : "personas"}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto p-2">
            {selected?.choferes.map((c) => (
              <Link
                key={c.id}
                href={`/choferes/${choferSlug(c)}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <AvatarPersona name={`${c.apellido}, ${c.nombre}`} rol={c.rol} size={32} />
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {c.apellido}, {c.nombre}
                </span>
                <StatusBadge label={c.estado} tone={c.estado === "activo" ? "success" : "neutral"} />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
