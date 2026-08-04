"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import MarcaLogo from "./MarcaLogo";
import EstadoSwitch from "./EstadoSwitch";
import {
  categoriaCapacidad,
  labelCategoriaCapacidad,
} from "@/lib/capacidad-camion";
import type { Camion } from "../types";
import { setCamionEstadoAction, type TipoServicio } from "../actions";

// Centinela que usa el seed de carga inicial (scripts/seed-camiones-acoplados.ts)
// para los tractores que en el Excel vinieron solo con patente. Las unidades con
// datos completos (marca real) son la "primera tanda" — las 11 resaltadas en
// amarillo por Bárbara.
const SIN_DATOS = "Sin datos";

// Tercerización: visual coherente con badges de estado.
//   Interno         → verde (operado por nosotros)
//   En transición   → ámbar (en proceso de salir hacia tercero)
//   Tercerizado     → gris  (lo maneja concesionaria, no entra a nuestro flujo de servicios)
const TERCERIZACION_BADGE: Record<
  NonNullable<Camion["tercerizacion_estado"]>,
  { label: string; cls: string }
> = {
  interno: { label: "Interno", cls: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" },
  en_transicion: { label: "En transición", cls: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" },
  tercerizado: { label: "Tercerizado", cls: "bg-muted text-muted-foreground border-border" },
};

/** Prender/apagar la unidad — lo comparten la fila (desktop) y la tarjeta (celular). */
function useEstadoCamion(camion: Camion) {
  const router = useRouter();
  const [pendingEstado, setPendingEstado] = useState(false);
  const activo = camion.estado === "activo";

  const toggleEstado = async () => {
    setPendingEstado(true);
    try {
      await setCamionEstadoAction(camion.id, activo ? "inactivo" : "activo");
      router.refresh();
    } finally {
      setPendingEstado(false);
    }
  };

  return { activo, pendingEstado, toggleEstado };
}

/** Los chips de "Datos completos / Solo patente / Tolva", iguales en fila y tarjeta. */
function ChipsUnidad({ datosCompletos, esTolva }: { datosCompletos: boolean; esTolva?: boolean | null }) {
  return (
    <>
      {datosCompletos ? (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E1F5FE] text-[#0369A1] text-[10px] font-bold uppercase tracking-wide w-fit"
          title="Unidad con datos completos — primera tanda (11 unidades)"
        >
          Datos completos
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wide w-fit"
          title="Cargado solo con patente — faltan marca, modelo, año y demás datos"
        >
          Solo patente
        </span>
      )}
      {esTolva && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-wide w-fit"
          title="Acoplado tolva"
        >
          Tolva
        </span>
      )}
    </>
  );
}

export default function CamionRow({
  camion,
  tiposServicio,
  onSelect,
}: {
  camion: Camion;
  tiposServicio: TipoServicio[];
  onSelect: (camion: Camion) => void;
}) {
  const terc = TERCERIZACION_BADGE[camion.tercerizacion_estado];
  const datosCompletos = !!camion.marca && camion.marca !== SIN_DATOS;
  const { activo, pendingEstado, toggleEstado } = useEstadoCamion(camion);

  return (
    <TableRow
      key={camion.id}
      className="cursor-pointer hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group"
      onClick={() => onSelect(camion)}
    >
        <TableCell className="py-4 pl-6">
          <div className="flex items-center gap-3">
            <MarcaLogo marca={camion.marca} foto={camion.foto_url} patente={camion.patente} />
            <div className="flex flex-col gap-1">
              <span className="font-mono font-medium text-foreground">{camion.patente}</span>
              <div className="flex items-center gap-1">
                <ChipsUnidad datosCompletos={datosCompletos} esTolva={camion.es_tolva} />
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {datosCompletos ? (
            <span>{camion.marca} {camion.modelo}</span>
          ) : (
            <span className="text-muted-foreground/50 italic">Sin datos</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span>{camion.ano ?? "—"}</span>
            {camion.km_actual != null && (
              <span
                className="text-[10px] text-muted-foreground/70 font-mono"
                title="Kilometraje actual (snapshot)"
              >
                {Number(camion.km_actual).toLocaleString("es-AR")} km
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span>{Number(camion.capacidad_tn).toFixed(1)} TN</span>
            <CategoriaCapacidadChip capacidad={camion.capacidad_tn} />
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{camion.tipo_camion ?? "—"}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            {camion.acoplados_vinculados && camion.acoplados_vinculados.length > 0 ? (
              <span className="font-mono text-xs text-foreground">
                {camion.acoplados_vinculados.join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground/50 italic text-xs">Sin acoplado</span>
            )}
            {camion.chofer_nombre ? (
              <span className="text-[11px] text-muted-foreground">{camion.chofer_nombre}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground/50 italic">Sin chofer</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {terc && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${terc.cls}`}
            >
              {terc.label}
            </span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <EstadoSwitch activo={activo} pending={pendingEstado} onToggle={toggleEstado} />
            <StatusBadge
              label={camion.estado}
              tone={
                camion.estado === "activo"
                  ? "success"
                  : camion.estado === "en_mantenimiento"
                    ? "warning"
                    : "neutral"
              }
            />
          </div>
        </TableCell>
      </TableRow>
  );
}

/**
 * La misma unidad, pero como tarjeta: es lo que se ve abajo de `md`, donde la
 * tabla de 8 columnas no entra. Mismos datos y mismas acciones que la fila
 * (abrir el detalle y prender/apagar la unidad), sólo cambia el acomodo.
 */
export function CamionCard({
  camion,
  onSelect,
}: {
  camion: Camion;
  onSelect: (camion: Camion) => void;
}) {
  const terc = TERCERIZACION_BADGE[camion.tercerizacion_estado];
  const datosCompletos = !!camion.marca && camion.marca !== SIN_DATOS;
  const { activo, pendingEstado, toggleEstado } = useEstadoCamion(camion);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(camion)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(camion);
        }
      }}
      className="w-full cursor-pointer px-4 py-3.5 text-left transition-colors active:bg-muted/50"
    >
      <div className="flex items-start gap-3">
        <MarcaLogo marca={camion.marca} foto={camion.foto_url} patente={camion.patente} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono font-medium text-foreground">{camion.patente}</span>
            <StatusBadge
              label={camion.estado}
              tone={
                camion.estado === "activo"
                  ? "success"
                  : camion.estado === "en_mantenimiento"
                    ? "warning"
                    : "neutral"
              }
            />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {datosCompletos ? (
              <>
                {camion.marca} {camion.modelo}
                {camion.ano ? ` — ${camion.ano}` : ""}
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
          <span className="text-foreground">{Number(camion.capacidad_tn).toFixed(1)} TN</span>
        </Dato>
        <Dato label="Km">
          <span className="font-mono text-foreground">
            {camion.km_actual != null ? `${Number(camion.km_actual).toLocaleString("es-AR")} km` : "—"}
          </span>
        </Dato>
        <Dato label="Tipo">
          <span className="text-foreground">{camion.tipo_camion ?? "—"}</span>
        </Dato>
        <Dato label="Acoplado">
          {camion.acoplados_vinculados && camion.acoplados_vinculados.length > 0 ? (
            <span className="font-mono text-foreground">
              {camion.acoplados_vinculados.join(", ")}
            </span>
          ) : (
            <span className="italic text-muted-foreground/70">Sin acoplado</span>
          )}
        </Dato>
        <div className="col-span-2">
          <Dato label="Chofer">
            {camion.chofer_nombre ? (
              <span className="text-foreground">{camion.chofer_nombre}</span>
            ) : (
              <span className="italic text-muted-foreground/70">Sin chofer</span>
            )}
          </Dato>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ChipsUnidad datosCompletos={datosCompletos} esTolva={camion.es_tolva} />
        {terc && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${terc.cls}`}
          >
            {terc.label}
          </span>
        )}
        <CategoriaCapacidadChip capacidad={camion.capacidad_tn} />
      </div>
    </div>
  );
}

/** Par rótulo/valor de las tarjetas de celular. */
export function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

// Pequeño chip que muestra a qué categoría (29/35/37,5) cae la capacidad.
// Sirve para filtrar visualmente la flota sin tener que mirar el número crudo
// (p.ej. los ~10 camiones de 37,5 que cargan más que el resto).
function CategoriaCapacidadChip({ capacidad }: { capacidad: number | null | undefined }) {
  const cat = categoriaCapacidad(capacidad);
  const label = labelCategoriaCapacidad(cat);
  if (!label) return null;
  const cls =
    cat === "37.5"
      ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
      : cat === "35"
        ? "bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`mt-0.5 inline-flex items-center self-start px-1.5 py-0 rounded border text-[10px] font-medium ${cls}`}
      title="Categoría de capacidad (agrupa modelos similares)"
    >
      {label}
    </span>
  );
}
