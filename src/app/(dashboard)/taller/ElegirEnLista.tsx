"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { coincideEnAlguno } from "@/lib/texto";

/**
 * Elegir una opción de una lista larga, con el dedo.
 *
 * Sube desde abajo y ocupa casi toda la pantalla a propósito: con 40 camiones,
 * un desplegable chico obliga a un scroll de precisión con el pulgar sobre una
 * lista que apenas se ve. Acá cada opción mide 60px y hay un buscador arriba.
 *
 * No usa `<select>` nativo: en Mac se ve mal y es una decisión vieja del
 * proyecto, pero además el nativo no deja buscar ni poner dos líneas por opción.
 */

export type OpcionLista = {
  id: string;
  /** Lo que se lee grande: la patente, el apellido. */
  principal: string;
  /** Debajo y en gris: el tipo de unidad, el nombre de pila. */
  secundario?: string;
};


/**
 * Un medidor para cuando el scroll no anda y el teléfono no es el de uno.
 *
 * Se enciende SOLO con `/taller?debug=scroll`; sin eso no existe. Nace de un
 * bug que no se podía reproducir: en el iPhone la lista no se dejaba deslizar,
 * y en la computadora andaba perfecto. Sin ver los números del aparato de al
 * lado, arreglarlo es adivinar — y adivinar ya costó un intento.
 *
 * Muestra el alto real de la lista contra el de su contenido: si son iguales,
 * la lista no tiene nada que correr y el problema es el layout; si el de
 * adentro es más grande y aun así no se mueve, el problema es el gesto.
 */
function Medidor({ lista }: { lista: React.RefObject<HTMLUListElement | null> }) {
  const [txt, setTxt] = useState("midiendo…");

  useEffect(() => {
    const medir = () => {
      const l = lista.current;
      if (!l) return;
      const vv = window.visualViewport;
      setTxt(
        [
          `ventana ${window.innerHeight}`,
          `visible ${vv ? Math.round(vv.height) : "?"}`,
          `lista ${l.clientHeight}/${l.scrollHeight}`,
          `corrida ${Math.round(l.scrollTop)}`,
          l.scrollHeight > l.clientHeight ? "PUEDE correr" : "NO tiene qué correr",
        ].join(" · "),
      );
    };
    medir();
    const t = setInterval(medir, 300);
    return () => clearInterval(t);
  }, [lista]);

  return (
    <p className="shrink-0 bg-amber-100 px-3 py-1.5 font-mono text-[11px] leading-tight text-amber-900">
      {txt}
    </p>
  );
}

export default function ElegirEnLista({
  abierto,
  onCerrar,
  titulo,
  opciones,
  elegidoId,
  onElegir,
  placeholder = "Buscar…",
  textoVacio = "Sin asignar",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  opciones: OpcionLista[];
  elegidoId: string | null;
  onElegir: (id: string | null) => void;
  placeholder?: string;
  textoVacio?: string;
}) {
  const [busca, setBusca] = useState("");
  const listaRef = useRef<HTMLUListElement>(null);
  // Sólo si se pide por la URL: es una herramienta para depurar en el teléfono
  // de otro, no algo que alguien tenga que ver sin haberlo pedido.
  const medir =
    typeof window !== "undefined" && window.location.search.includes("debug=scroll");

  const filtradas = useMemo(() => {
    if (!busca.trim()) return opciones;
    // Sin acentos: "matias" tiene que encontrar "Matías".
    return opciones.filter((o) => coincideEnAlguno([o.principal, o.secundario], busca));
  }, [opciones, busca]);

  const elegir = (id: string | null) => {
    onElegir(id);
    setBusca("");
    onCerrar();
  };

  return (
    <Sheet
      open={abierto}
      onOpenChange={(v) => {
        if (!v) {
          setBusca("");
          onCerrar();
        }
      }}
    >
      {/* `overflow-hidden` acá y el scroll SOLO en la lista.
          
          Con el panel scrolleable por fuera y la lista scrolleable por dentro
          quedaban dos contenedores de scroll anidados, y en el teléfono el
          gesto se le asignaba al de afuera —que no tiene nada que correr—:
          arrastrabas sobre los camiones y no se movía nada. En la compu no se
          notaba, porque la rueda va siempre al elemento que está abajo del
          cursor. Lo reportó Julián el 27/08. */}
      {/* Altura FIJA y en `svh`, no `h-auto` + `max-h-dvh`.
          
          En el iPhone, `dvh` cuenta también la franja que tapa la barra
          flotante de Safari, y el panel se ancla a `bottom: 0` del viewport de
          layout —o sea, por debajo de esa barra—. Resultado: el panel se
          calculaba más alto de lo que se ve, la lista se estiraba con él y el
          sobrante quedaba abajo, tapado y fuera de alcance. `svh` es la altura
          del viewport CHICO (con las barras desplegadas): lo que se ve seguro,
          esté la barra donde esté. Y con la altura fija el flex reparte sin
          ambigüedad, así que a la lista le queda exactamente el resto. */}
      <SheetContent
        side="bottom"
        className="overflow-hidden p-0 data-[side=bottom]:h-[85svh] data-[side=bottom]:max-h-[85svh]"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <SheetTitle className="text-base">{titulo}</SheetTitle>
        </SheetHeader>

        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <input
              // 16px: por debajo de eso iOS hace zoom solo al enfocar.
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
              autoComplete="off"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Borrar la búsqueda"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* `min-h-0` para que el flex la deje encogerse (sin eso mide lo que
            miden las 40 opciones), `overscroll-contain` para que el tirón no se
            escape a la página de atrás y `touch-pan-y` para que el dedo mueva
            la lista y no otra cosa. */}
        {medir && <Medidor lista={listaRef} />}

        <ul ref={listaRef} className="min-h-0 flex-1 touch-pan-y divide-y divide-border/60 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Quitar lo elegido va PRIMERO y siempre: es la salida de quien tocó
              por error, y buscarla al final de 40 opciones no es una salida. */}
          <li>
            <button
              type="button"
              onClick={() => elegir(null)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-muted"
            >
              <span className="text-base text-muted-foreground">{textoVacio}</span>
              {elegidoId === null && <Check size={18} className="shrink-0 text-primary" />}
            </button>
          </li>

          {filtradas.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay ninguno que coincida con “{busca}”.
            </li>
          ) : (
            filtradas.map((o) => {
              const activo = o.id === elegidoId;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => elegir(o.id)}
                    className={`flex min-h-15 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-muted ${
                      activo ? "bg-primary/[0.06]" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-foreground">
                        {o.principal}
                      </span>
                      {o.secundario && (
                        <span className="block truncate text-sm text-muted-foreground">
                          {o.secundario}
                        </span>
                      )}
                    </span>
                    {activo && <Check size={18} className="shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
