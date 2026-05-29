import { Truck } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Camion } from "../types";
import type { TipoServicio } from "../actions";

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

  return (
    <TableRow
      key={camion.id}
      className="cursor-pointer hover:bg-muted/40 transition-all border-b border-[#F1F5F9] last:border-0 group"
      onClick={() => onSelect(camion)}
    >
        <TableCell className="py-4 pl-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E1F5FE] flex items-center justify-center shrink-0 overflow-hidden border border-[#B3E5FC]">
              {camion.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={camion.foto_url}
                  alt={camion.patente}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Truck size={18} className="text-primary" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono font-medium text-foreground">{camion.patente}</span>
              <div className="flex items-center gap-1">
                {datosCompletos ? (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E1F5FE] text-[#0369A1] text-[10px] font-bold uppercase tracking-wide w-fit"
                    title="Unidad con datos completos — primera tanda (las 11 resaltadas en amarillo por Bárbara)"
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
                {camion.es_tolva && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold uppercase tracking-wide w-fit"
                    title="Acoplado tolva (marcado en el Excel de Bárbara)"
                  >
                    Tolva
                  </span>
                )}
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
        <TableCell>{Number(camion.capacidad_tn).toFixed(1)} TN</TableCell>
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
        </TableCell>
      </TableRow>
  );
}
