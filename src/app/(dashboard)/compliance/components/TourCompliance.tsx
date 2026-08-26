"use client";

import { useCallback, useEffect, useState } from "react";
import { Route } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TourGuiado, { pasosVisibles, type PasoTour } from "@/components/help/TourGuiado";

/**
 * El recorrido guiado de Compliance.
 *
 * Sale de un pedido concreto (Bárbara, 25/08/2026): Ana —seguridad— y Noelia no
 * encontraban dónde cargar la VTV y la terminaron cargando desde la ficha del
 * camión. La pantalla no estaba mal: el camino era el filtro «Tipo de documento»,
 * que quien ya sabe ve enseguida y quien entra por primera vez no.
 *
 * Por eso el recorrido arranca solo la primera vez que alguien abre Compliance,
 * y después queda a mano en el botón «Recorrido». La marca de "ya lo vio" va en
 * el navegador, por usuario, igual que el resumen del día.
 */

/** Otras partes de la pantalla pueden relanzarlo: `window.dispatchEvent(new Event(EVENTO_TOUR_COMPLIANCE))`. */
export const EVENTO_TOUR_COMPLIANCE = "dj:tour-compliance";

const CLAVE_PREFIX = "dj_tour_compliance_";

/** Los pasos, en el orden en que se hace el trabajo: buscar → mirar → cargar → comprobar. */
const PASOS: PasoTour[] = [
  {
    id: "por-tipo",
    target: '[data-tour="por-tipo"]',
    titulo: "Acá está cada papel que se pide",
    texto:
      "Una tarjeta por tipo de documento —VTV, carnet, seguros, F931— con qué porcentaje está al día y cuántos faltan. Tocá una y se abre abajo la lista de a quién le falta; desde ahí mismo lo cargás.",
  },
  {
    id: "filtro-tipo",
    target: '[data-tour="filtro-tipo"]',
    titulo: "O buscalo por el filtro",
    texto:
      "Es el otro camino para lo mismo: elegís el papel —VTV, carnet, seguro— y la lista de abajo queda solo con ese, una fila por unidad o por chofer.",
  },
  {
    id: "metricas",
    target: '[data-tour="metricas"]',
    titulo: "Cómo viene la cosa",
    texto:
      "Al día, por vencer, vencido y sin cargar. Son botones: tocás uno y la lista queda con esos nada más.",
  },
  {
    id: "cargar",
    target: '[data-tour="btn-cargar"]',
    titulo: "Cargar el que falta",
    texto:
      "Las filas que dicen «Cargar» no tienen nada presentado todavía. Se abre una ventana donde lo único obligatorio es el vencimiento; el PDF podés arrastrarlo ahí mismo o subirlo después.",
  },
  {
    id: "acciones",
    target: '[data-tour="acciones-fila"]',
    titulo: "Acá se ve el papel",
    texto:
      "El primer ícono abre el documento adentro del sistema —no se descarga ni te saca de la pantalla— y desde ahí lo podés imprimir o bajar. El reloj muestra todas las veces que se presentó y quién lo cargó. El lápiz corrige la fecha o suma un papel nuevo.",
  },
  {
    id: "sin-papel",
    target: '[data-tour="acciones-fila"]',
    titulo: "Y cuáles no lo tienen",
    texto:
      "Cuando ese primer ícono está tachado y en gris, esa fila tiene la fecha cargada pero nadie subió el papel. Tocándolo se abre la ventana para subirlo.",
  },
  {
    id: "rail",
    target: '[data-tour="rail"]',
    titulo: "Atajos de la derecha",
    texto:
      "Lo mismo, agrupado por dónde entrar: lo de la empresa, lo de cada unidad y lo de cada chofer. Tocás un renglón y la lista queda filtrada.",
  },
  {
    id: "ayuda",
    target: '[data-tour="ayuda"]',
    titulo: "Para volver a verlo",
    texto:
      "Este botón vuelve a abrir el recorrido cuando quieras. Al lado está la guía con capturas, por si preferís leerla.",
  },
];

export default function TourCompliance({ userId }: { userId: string }) {
  const [bienvenida, setBienvenida] = useState(false);
  const [pasos, setPasos] = useState<PasoTour[] | null>(null);

  const marcarVisto = useCallback(() => {
    try {
      window.localStorage.setItem(`${CLAVE_PREFIX}${userId}`, new Date().toISOString());
    } catch {
      // localStorage lleno o bloqueado: el recorrido igual funciona, solo que
      // vuelve a ofrecerse la próxima vez. No es motivo para romper la pantalla.
    }
  }, [userId]);

  const arrancar = useCallback(() => {
    setBienvenida(false);
    marcarVisto();
    // Se filtran los pasos cuyo elemento no está: la columna de la derecha no
    // existe en pantallas angostas y "Cargar" no aparece si no quedó ninguno
    // pendiente a la vista. Un paso apuntando a la nada es peor que no tenerlo.
    //
    // Pero se mide DESPUÉS de dos cuadros: arrancándolo apenas carga la pantalla,
    // el checklist todavía no está pintado y se caían los dos pasos que hablan de
    // la lista — el recorrido decía "5 de 5" y nunca contaba cómo ver el papel.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setPasos(pasosVisibles(PASOS))),
    );
  }, [marcarVisto]);

  // Primera visita: se ofrece el recorrido. Con un respiro, para no pisarse con
  // el resumen del día — si hay otra ventana abierta, este pop-up espera a la
  // próxima vez en lugar de amontonarse encima.
  useEffect(() => {
    let cancelado = false;
    let intentos = 0;
    let t: ReturnType<typeof setTimeout>;

    // Si el resumen del día está abierto, no se pisa: espera a que lo cierren.
    // Antes se salteaba y no volvía hasta la visita siguiente — y para quien
    // entra directo a esta pantalla todos los días, esa visita siguiente era
    // mañana. Reintenta durante medio minuto y después se rinde.
    const ofrecer = () => {
      if (cancelado) return;
      try {
        if (window.localStorage.getItem(`${CLAVE_PREFIX}${userId}`)) return;
      } catch {
        return;
      }
      if (document.querySelector('[data-slot="dialog-content"]')) {
        if (++intentos > 30) return;
        t = setTimeout(ofrecer, 1000);
        return;
      }
      setBienvenida(true);
    };

    t = setTimeout(ofrecer, 1200);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [userId]);

  // Relanzarlo desde el botón "Recorrido".
  useEffect(() => {
    const abrir = () => arrancar();
    window.addEventListener(EVENTO_TOUR_COMPLIANCE, abrir);
    return () => window.removeEventListener(EVENTO_TOUR_COMPLIANCE, abrir);
  }, [arrancar]);

  return (
    <>
      <Dialog
        open={bienvenida}
        onOpenChange={(v) => {
          setBienvenida(v);
          // Cerrarlo también cuenta como visto: ofrecerlo en cada visita hasta
          // que alguien diga que sí es exactamente lo que molesta de estas cosas.
          if (!v) marcarVisto();
        }}
      >
        <DialogContent className="sm:max-w-[26rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Route size={18} className="shrink-0 text-primary" />
              ¿Te muestro cómo se usa esta pantalla?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Son ocho pasos, menos de un minuto. Te voy señalando dónde se elige el tipo de
              documento, cómo cargar el que falta y cómo mirar el papel de los que ya están.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-muted-foreground"
              onClick={() => {
                setBienvenida(false);
                marcarVisto();
              }}
            >
              Ahora no
            </Button>
            <Button variant="brand" onClick={arrancar}>
              Mostrame
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TourGuiado
        pasos={pasos ?? []}
        abierto={pasos !== null && pasos.length > 0}
        onCerrar={() => setPasos(null)}
      />
    </>
  );
}

/** El botón que vuelve a abrir el recorrido. Va en la barra de acciones. */
export function BotonRecorrido() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-border"
      title="Recorrido guiado — te señala en la pantalla dónde está cada cosa"
      onClick={() => window.dispatchEvent(new Event(EVENTO_TOUR_COMPLIANCE))}
    >
      <Route size={14} className="sm:mr-1.5" />
      <span className="hidden sm:inline">Recorrido</span>
    </Button>
  );
}
