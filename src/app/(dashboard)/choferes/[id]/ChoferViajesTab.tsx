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
      <h3 className="text-sm font-semibold text-[#0F172A]">
        Últimos viajes
        <span className="ml-2 text-xs font-normal text-[#94A3B8]">
          {viajes.length} registro{viajes.length !== 1 ? "s" : ""}
        </span>
      </h3>

      <div className="rounded-[8px] border border-[#E2E8F0] overflow-hidden">
        <Table>
          <TableHeader className="bg-[#F8FAFC]">
            <TableRow>
              {["Código", "Fecha", "KM", "Estado", "Facturado"].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-[#475569] uppercase tracking-wide"
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
                <TableRow key={v.id} className="hover:bg-[#F8FAFC]">
                  <TableCell className="font-mono text-xs text-[#0088D1]">{v.codigo}</TableCell>
                  <TableCell className="text-sm text-[#475569]">
                    {new Date(v.fecha_viaje).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-sm text-[#475569]">
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
                        v.facturado ? "text-[#10B981]" : "text-[#94A3B8]"
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
