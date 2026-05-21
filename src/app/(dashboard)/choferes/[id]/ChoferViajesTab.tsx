import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import type { ViajeBasico } from "./types";

interface Props {
  viajes: ViajeBasico[];
}

const ESTADO_TONE: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
  cerrado: "success",
  en_curso: "info",
  pendiente: "warning",
  cancelado: "error",
};

export default function ChoferViajesTab({ viajes }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        Últimos viajes
        <span className="ml-2 text-xs font-normal text-muted-foreground/70">
          {viajes.length} registro{viajes.length !== 1 ? "s" : ""}
        </span>
      </h3>

      <div className="rounded-[8px] border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Código", "Fecha", "KM", "Estado", "Facturado"].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {viajes.length === 0 ? (
              <EmptyTableRow message="Sin viajes registrados" />
            ) : (
              viajes.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-primary">{v.codigo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(v.fecha_viaje).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(v.km_con_carga + v.km_vacios).toLocaleString("es-AR")} km
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={v.estado.replace("_", " ")}
                      tone={ESTADO_TONE[v.estado] ?? "neutral"}
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium ${
                        v.facturado ? "text-[#10B981]" : "text-muted-foreground/70"
                      }`}
                    >
                      {v.facturado ? "Sí" : "No"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
