"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "lucide-react";
import { logoDeMarca } from "@/components/ui/MarcaLogo";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import EstadoSwitch from "./EstadoSwitch";
import { Dato } from "./CamionRow";
import { updateAcopladoAction } from "../actions";
import { etiquetaAcopladoTipo } from "../types";
import type { Acoplado } from "../types";

/** Prender/apagar el acoplado — lo comparten la fila (desktop) y la tarjeta (celular). */
function useEstadoAcoplado(acoplado: Acoplado) {
  const router = useRouter();
  const [pendingEstado, setPendingEstado] = useState(false);
  const activo = acoplado.estado === "activo";

  const toggleEstado = async () => {
    setPendingEstado(true);
    try {
      await updateAcopladoAction(acoplado.id, { estado: activo ? "inactivo" : "activo" });
      router.refresh();
    } finally {
      setPendingEstado(false);
    }
  };

  return { activo, pendingEstado, toggleEstado };
}

/** Avatar del acoplado: logo de marca si lo hay, si no el ícono de contenedor. */
function AcopladoAvatar({ logo, size = 40 }: { logo: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-[#F1F5F9]"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- SVG local
        <img
          src={logo}
          alt=""
          className="object-contain"
          style={{ maxHeight: size * 0.55, maxWidth: size * 0.78 }}
          loading="lazy"
        />
      ) : (
        <Container size={Math.round(size * 0.45)} className="text-muted-foreground" />
      )}
    </div>
  );
}

export default function AcopladoRow({ acoplado, onSelect }: { acoplado: Acoplado; onSelect?: (a: Acoplado) => void }) {
  const datosCompletos = !!acoplado.marca;
  // Los acoplados casi nunca son de estas marcas, pero si lo son se ve igual.
  const logoAcoplado = logoDeMarca(acoplado.marca);
  const { activo, pendingEstado, toggleEstado } = useEstadoAcoplado(acoplado);

  return (
    <TableRow
      onClick={() => onSelect?.(acoplado)}
      className="hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group cursor-pointer"
    >
      <TableCell className="py-4 pl-6">
        <div className="flex items-center gap-3">
          <AcopladoAvatar logo={logoAcoplado} />
          <div className="flex flex-col gap-1">
            <span className="font-mono font-medium text-foreground">{acoplado.patente}</span>
            <div className="flex items-center gap-1">
              {!datosCompletos && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wide w-fit">
                  Solo patente
                </span>
              )}
              {acoplado.es_tolva && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-wide w-fit">
                  Tolva
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {datosCompletos ? (
          <span>{acoplado.marca} {acoplado.modelo}</span>
        ) : (
          <span className="text-muted-foreground/50 italic">Sin datos</span>
        )}
      </TableCell>
      <TableCell>{acoplado.ano ?? "—"}</TableCell>
      <TableCell>
        {acoplado.capacidad_tn != null ? `${Number(acoplado.capacidad_tn).toFixed(1)} TN` : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{etiquetaAcopladoTipo(acoplado.tipo)}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          {acoplado.camion_patente ? (
            <span className="font-mono text-xs text-foreground">{acoplado.camion_patente}</span>
          ) : (
            <span className="text-muted-foreground/50 italic text-xs">Sin camión</span>
          )}
          {acoplado.chofer_nombre ? (
            <span className="text-[11px] text-muted-foreground">{acoplado.chofer_nombre}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 italic">Sin chofer</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <EstadoSwitch activo={activo} pending={pendingEstado} onToggle={toggleEstado} />
          <StatusBadge
            label={acoplado.estado}
            tone={activo ? "success" : "neutral"}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * El acoplado como tarjeta, para abajo de `md`. Mismos datos y mismas acciones
 * que la fila; sólo cambia cómo se acomoda.
 */
export function AcopladoCard({
  acoplado,
  onSelect,
}: {
  acoplado: Acoplado;
  onSelect?: (a: Acoplado) => void;
}) {
  const datosCompletos = !!acoplado.marca;
  const logoAcoplado = logoDeMarca(acoplado.marca);
  const { activo, pendingEstado, toggleEstado } = useEstadoAcoplado(acoplado);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(acoplado)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(acoplado);
        }
      }}
      className="w-full cursor-pointer px-4 py-3.5 text-left transition-colors active:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        <AcopladoAvatar logo={logoAcoplado} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono font-medium text-foreground">{acoplado.patente}</span>
            <StatusBadge label={acoplado.estado} tone={activo ? "success" : "neutral"} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {datosCompletos ? (
              <>
                {acoplado.marca} {acoplado.modelo ?? ""}
                {acoplado.ano ? ` — ${acoplado.ano}` : ""}
              </>
            ) : (
              <span className="italic">Sin datos de marca/modelo</span>
            )}
          </p>
        </div>
        <EstadoSwitch activo={activo} pending={pendingEstado} onToggle={toggleEstado} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Dato label="Capacidad">
          <span className="text-foreground">
            {acoplado.capacidad_tn != null ? `${Number(acoplado.capacidad_tn).toFixed(1)} TN` : "—"}
          </span>
        </Dato>
        <Dato label="Tipo">
          <span className="text-foreground">{etiquetaAcopladoTipo(acoplado.tipo)}</span>
        </Dato>
        <Dato label="Camión">
          {acoplado.camion_patente ? (
            <span className="font-mono text-foreground">{acoplado.camion_patente}</span>
          ) : (
            <span className="italic text-muted-foreground/70">Sin camión</span>
          )}
        </Dato>
        <Dato label="Chofer">
          {acoplado.chofer_nombre ? (
            <span className="text-foreground">{acoplado.chofer_nombre}</span>
          ) : (
            <span className="italic text-muted-foreground/70">Sin chofer</span>
          )}
        </Dato>
      </dl>

      {(!datosCompletos || acoplado.es_tolva) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {!datosCompletos && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wide">
              Solo patente
            </span>
          )}
          {acoplado.es_tolva && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-wide">
              Tolva
            </span>
          )}
        </div>
      )}
    </div>
  );
}
