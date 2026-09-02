"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import AusenciaDialog from "@/components/ausencias/AusenciaDialog";
import {
  getChoferesParaDiaPedidoAction,
  type ChoferParaDiaPedido,
} from "./dias-pedidos-actions";

/**
 * Alta rápida de un día pedido (turno médico, trámite, dentista).
 *
 * Bárbara los recibe por teléfono en cualquier momento del día — "te piden el
 * día para ir a hacerse un carnet, un turno, el dentista" — y hasta ahora no
 * tenían dónde anotarse: había que entrar al legajo del chofer, buscar la
 * pestaña y cargar una ausencia. Por eso las 170 ausencias del sistema son
 * todas vacaciones. Acá se hace desde el tablero, sin salir de la pantalla.
 *
 * El formulario es el mismo que el del legajo (`AusenciaDialog`); lo único
 * propio de acá es elegir de quién es el día y que nunca descuente vacaciones:
 * "no quiero que se lo agregue como vacaciones, le doy el día porque le doy el
 * día" (Bárbara, 02/09/2026).
 */
export default function DiaPedidoQuickAction() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choferes, setChoferes] = useState<ChoferParaDiaPedido[]>([]);

  // Los choferes se piden al abrir, no al montar: es un botón del tablero y no
  // tiene sentido pagar la consulta en cada carga de la página.
  useEffect(() => {
    if (!open || choferes.length > 0) return;
    getChoferesParaDiaPedidoAction()
      .then(setChoferes)
      .catch(() => setChoferes([]));
  }, [open, choferes.length]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5"
        title="Registrar un día pedido (turno médico, trámite)"
      >
        <CalendarPlus size={15} />
        Día pedido
      </Button>

      <AusenciaDialog
        open={open}
        onOpenChange={setOpen}
        choferes={choferes}
        variante="dia-pedido"
        onSuccess={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
