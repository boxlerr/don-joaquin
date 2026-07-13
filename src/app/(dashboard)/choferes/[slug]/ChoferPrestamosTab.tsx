"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Banknote, Plus, Trash2, Pencil } from "lucide-react";
import CargarPrestamoDialog from "./CargarPrestamoDialog";
import { actualizarSaldoPrestamoAction, eliminarPrestamoAction } from "./actions";
import type { Prestamo, PrestamoEstado } from "./types";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer_id: string;
  prestamos: Prestamo[];
  can_write: boolean;
  onRefresh: () => void;
}

const fmtMonto = (v: number, moneda: string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda || "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

function estadoTone(e: PrestamoEstado): "success" | "warning" | "error" | "info" | "neutral" {
  if (e === "cancelado") return "success";
  if (e === "parcial") return "info";
  if (e === "pendiente") return "warning";
  if (e === "incobrable") return "error";
  return "neutral";
}

function estadoLabel(e: PrestamoEstado): string {
  if (e === "pendiente") return "Pendiente";
  if (e === "parcial") return "En pago";
  if (e === "cancelado") return "Saldado";
  return "Incobrable";
}

export default function ChoferPrestamosTab({
  chofer_id,
  prestamos,
  can_write,
  onRefresh,
}: Props) {
  const [cargarOpen, setCargarOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalPendiente = prestamos.reduce(
    (acc, p) => (p.estado === "cancelado" || p.estado === "incobrable" ? acc : acc + p.saldo_pendiente),
    0,
  );

  const handleDelete = async (p: Prestamo) => {
    if (!confirm(`¿Eliminar el préstamo del ${formatFecha(p.fecha)}?`))
      return;
    setBusyId(p.id);
    await eliminarPrestamoAction(p.id, chofer_id);
    setBusyId(null);
    onRefresh();
  };

  const handleActualizar = async (p: Prestamo) => {
    const nuevoStr = prompt(
      `Saldo pendiente actual: ${fmtMonto(p.saldo_pendiente, p.moneda)}\nIngresá el nuevo saldo:`,
      String(p.saldo_pendiente),
    );
    if (nuevoStr === null) return;
    const nuevo = Number(nuevoStr);
    if (!Number.isFinite(nuevo) || nuevo < 0) {
      alert("El saldo debe ser un número mayor o igual a cero");
      return;
    }
    setBusyId(p.id);
    const res = await actualizarSaldoPrestamoAction(p.id, chofer_id, nuevo);
    setBusyId(null);
    if (res.error) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Préstamos
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {prestamos.length} registro{prestamos.length !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex items-center gap-3">
          {prestamos.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Saldo pendiente:{" "}
              <span className="font-medium text-foreground">{fmtMonto(totalPendiente, "ARS")}</span>
            </span>
          )}
          {can_write && (
            <Button
              variant="outline"
              size="sm"
              className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
              onClick={() => setCargarOpen(true)}
            >
              <Plus size={13} className="mr-1.5 text-primary" />
              Nuevo préstamo
            </Button>
          )}
        </div>
      </div>

      {prestamos.length === 0 ? (
        <EmptyState icon={Banknote} message="Sin préstamos registrados" />
      ) : (
        <div className="space-y-2">
          {prestamos.map((p) => (
            <div
              key={p.id}
              className="bg-card rounded-[8px] border border-border p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {formatFecha(p.fecha)}
                  </span>
                  <StatusBadge label={estadoLabel(p.estado)} tone={estadoTone(p.estado)} />
                  <span className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-full px-2 py-0.5">
                    {p.cuotas} cuota{p.cuotas !== 1 ? "s" : ""}
                  </span>
                </div>
                {can_write && (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => handleActualizar(p)}
                      disabled={busyId === p.id}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Pencil size={11} />
                      Saldo
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={busyId === p.id}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 size={11} />
                      {busyId === p.id ? "..." : "Eliminar"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Monto
                  </p>
                  <p className="text-foreground font-medium">{fmtMonto(p.monto, p.moneda)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Saldo pendiente
                  </p>
                  <p className="text-foreground font-medium">
                    {fmtMonto(p.saldo_pendiente, p.moneda)}
                  </p>
                </div>
              </div>

              {p.motivo && (
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground/70 text-xs uppercase tracking-wide mr-1.5">
                    Motivo:
                  </span>
                  {p.motivo}
                </p>
              )}
              {p.observaciones && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t border-[#F1F5F9] pt-2">
                  {p.observaciones}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <CargarPrestamoDialog
        chofer_id={chofer_id}
        open={cargarOpen}
        onOpenChange={setCargarOpen}
        onSuccess={() => {
          setCargarOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}
