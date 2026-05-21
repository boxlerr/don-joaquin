import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import type { MovimientoChofer } from "./types";

interface Props {
  movimientos: MovimientoChofer[];
}

const CATEGORIA_LABELS: Record<string, string> = {
  cobro_cliente: "Cobro cliente",
  pago_proveedor: "Pago proveedor",
  entrega_viatico: "Viático",
  rendicion_vuelto: "Rendición",
  gasto_operativo: "Gasto operativo",
  pago_chofer: "Pago chofer",
  transferencia_interna: "Transferencia",
  ajuste: "Ajuste",
  otro: "Otro",
};

export default function ChoferCuentaTab({ movimientos }: Props) {
  const totalIngresos = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const totalEgresos = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const saldo = totalIngresos - totalEgresos;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        Cuenta corriente — mes actual
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatMini
          label="Saldo"
          value={`$${saldo.toLocaleString("es-AR")}`}
          color={saldo >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}
        />
        <StatMini
          label="Ingresos"
          value={`$${totalIngresos.toLocaleString("es-AR")}`}
          color="text-[#10B981]"
        />
        <StatMini
          label="Egresos"
          value={`$${totalEgresos.toLocaleString("es-AR")}`}
          color="text-[#EF4444]"
        />
        <StatMini
          label="Movimientos"
          value={String(movimientos.length)}
          color="text-primary"
        />
      </div>

      <div className="rounded-[8px] border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Fecha", "Concepto", "Categoría", "Monto"].map((col) => (
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
            {movimientos.length === 0 ? (
              <EmptyTableRow message="Sin movimientos este mes" />
            ) : (
              movimientos.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.fecha).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell className="text-sm text-[#1E293B] max-w-[200px] truncate">
                    {m.concepto}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {CATEGORIA_LABELS[m.categoria] ?? m.categoria}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-semibold ${
                      m.tipo === "ingreso" ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {m.tipo === "ingreso" ? "+" : "-"}$
                    {m.monto.toLocaleString("es-AR")}
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

function StatMini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-[8px] border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground/70 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
