"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Wallet, Loader2 } from "lucide-react";
import { getMisMovimientosRecientesAction, type MisMovimientoRow } from "../actions";

const CATEGORIA_LABEL: Record<string, string> = {
  cobro_cliente: "Cobro a cliente",
  pago_proveedor: "Pago a proveedor",
  entrega_viatico: "Entrega de viático",
  rendicion_vuelto: "Rendición / vuelto",
  gasto_operativo: "Gasto operativo",
  pago_chofer: "Pago a chofer",
  transferencia_interna: "Transferencia interna",
  ajuste: "Ajuste",
  otro: "Otro",
};

const MEDIO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
  otro: "Otro",
};

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Lista para el "modo operador" (operar ≠ ver): solo las últimas cargas
 * PROPIAS de la caja diaria, sin totales ni saldo. Sirve para que quien
 * carga movimientos pueda verificar que lo suyo quedó registrado.
 */
export default function MisMovimientosRecientes() {
  const [rows, setRows] = useState<MisMovimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Los dialogs de carga disparan "caja:refresh" al confirmar.
  useEffect(() => {
    const handler = () => setRefreshTick((t) => t + 1);
    window.addEventListener("caja:refresh", handler);
    return () => window.removeEventListener("caja:refresh", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al refrescar (carga o reset de estado)
    setLoading(true);
    getMisMovimientosRecientesAction().then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else {
        setRows(result);
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Tus últimos movimientos cargados</h2>
        </div>
        <p className="text-xs text-muted-foreground">Se muestran hasta 20</p>
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {["Fecha", "Concepto", "Tipo", "Medio de pago", "Monto"].map((col) => (
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
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground/70 text-sm">
                <Loader2 className="inline-block animate-spin mr-2" size={14} />
                Cargando movimientos...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-[#EF4444] text-sm">
                {error}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <EmptyTableRow message="Todavía no cargaste movimientos" />
          ) : (
            rows.map((m) => {
              const esIngreso = m.tipo === "ingreso";
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFecha(m.fecha)}
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-medium">{m.concepto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {MEDIO_LABEL[m.medio] ?? m.medio}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-semibold ${
                      esIngreso ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {esIngreso ? "+" : "-"} $ {formatARS(m.monto)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
