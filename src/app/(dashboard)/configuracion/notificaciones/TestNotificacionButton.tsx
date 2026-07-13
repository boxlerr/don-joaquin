"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { pushToast } from "@/components/notificaciones/toastStore";
import { enviarPruebaNotificacionAction } from "./actions";

export default function TestNotificacionButton() {
  const [enviando, setEnviando] = useState(false);

  async function handleClick() {
    setEnviando(true);
    try {
      const res = await enviarPruebaNotificacionAction();
      if ("error" in res) {
        pushToast({
          key: `prueba-err-${Date.now()}`,
          variant: "resumen",
          severidad: "critica",
          titulo: "No se pudo enviar la prueba",
          mensaje: res.error,
          href: null,
        });
      } else {
        const n = res.total ?? 0;
        pushToast({
          key: `prueba-ok-${Date.now()}`,
          variant: "resumen",
          severidad: "info",
          titulo: "Prueba enviada",
          mensaje: `Se envió a ${res.email} (${n} alerta${n !== 1 ? "s" : ""}). Revisá tu bandeja de entrada.`,
          href: null,
        });
      }
    } catch {
      pushToast({
        key: `prueba-err-${Date.now()}`,
        variant: "resumen",
        severidad: "critica",
        titulo: "Error inesperado",
        mensaje: "Ocurrió un problema al enviar la prueba. Probá de nuevo.",
        href: null,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={enviando} variant="outline" size="sm">
      {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      Enviar prueba a mi correo
    </Button>
  );
}
