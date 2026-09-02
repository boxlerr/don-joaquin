"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, RefreshCw, Search, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { filtrarChoferes, linkWhatsapp, mensajeParaChofer } from "@/domain/gasoil/enlace";
import { getDatosDelEnlaceAction, rotarEnlaceChoferAction } from "./actions";
import type { DatosDelEnlace } from "./tipos";

/**
 * Mandarle el enlace a los choferes.
 *
 * Es **un solo enlace para los 61** (decisión de Julián, 02/09/2026): se manda
 * una vez y listo, sin cuentas ni contraseñas para nadie. De ahí salen las dos
 * formas de mandarlo que hay acá:
 *
 *  * **Copiar el mensaje** y pegarlo en el grupo de WhatsApp. Es el camino de
 *    todos los días: un pegado y los 61 lo tienen.
 *  * **Mandárselo a uno**, con el botón de al lado de cada nombre. Sirve para el
 *    que entra nuevo, o para el que lo perdió y hay que reenviárselo sin
 *    molestar al grupo.
 *
 * Se copia el mensaje entero y no la URL pelada a propósito: un link solo en un
 * grupo de WhatsApp no le dice a nadie qué tiene que hacer con eso.
 */
export default function EnviarEnlaceDialog({
  open,
  onOpenChange,
  puedeRotar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puedeRotar: boolean;
}) {
  const [datos, setDatos] = useState<DatosDelEnlace | null>(null);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState<"mensaje" | "url" | null>(null);
  const [confirmarRotar, setConfirmarRotar] = useState(false);
  const [rotando, setRotando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // El enlace se lee cada vez que se abre y no una sola vez: si otra persona
    // lo rotó desde su pantalla, mostrar el viejo sería mandarle a los choferes
    // un link muerto.
    /* eslint-disable react-hooks/set-state-in-effect -- traer los datos al abrir el diálogo */
    setCargando(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getDatosDelEnlaceAction()
      .then(setDatos)
      .catch(() => setError("No se pudo leer el enlace."))
      .finally(() => setCargando(false));
  }, [open]);

  const mensaje = datos?.enlace ? mensajeParaChofer(datos.enlace.url) : "";
  const esLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(datos?.enlace?.url ?? "");
  const lista = useMemo(
    () => filtrarChoferes(datos?.choferes ?? [], busqueda),
    [datos, busqueda],
  );
  const sinWhatsapp = (datos?.choferes ?? []).filter((c) => !linkWhatsapp(c.telefono, "x")).length;

  async function copiar(que: "mensaje" | "url") {
    const texto = que === "mensaje" ? mensaje : (datos?.enlace?.url ?? "");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(que);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError("El navegador no dejó copiar. Seleccioná el texto a mano.");
    }
  }

  async function rotar() {
    setRotando(true);
    setError(null);
    const r = await rotarEnlaceChoferAction();
    setRotando(false);
    setConfirmarRotar(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setCargando(true);
    setDatos(await getDatosDelEnlaceAction());
    setCargando(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* `sm:max-w-xl` y no `max-w-xl`: la base del diálogo trae `sm:max-w-sm`, y
          tailwind-merge no pisa una variante responsive con una clase pelada — el
          diálogo se quedaba en 384 px y recortaba los botones de WhatsApp. */}
      <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar el enlace a los choferes</DialogTitle>
            <DialogDescription>
              El chofer lo abre, pone de dónde salió, a dónde va y cuántas toneladas cargó, y la
              pantalla le dice cuántos litros puede cargar. Queda anotado acá solo. No necesita
              usuario ni contraseña.
            </DialogDescription>
          </DialogHeader>

          {cargando && !datos ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : !datos?.enlace ? (
            <Aviso>
              No hay ningún enlace activo. Falta correr la migración{" "}
              <code className="font-mono text-[12px]">20260902_gasoil_enlace_chofer.sql</code>
              {puedeRotar ? ", o generá uno con el botón de abajo." : "."}
            </Aviso>
          ) : (
            <div className="space-y-5">
              {/* Un enlace a localhost es un enlace que no le sirve a nadie, y en un
                  grupo de 61 choferes el error no se puede deshacer. Si falta la URL
                  pública, se dice acá antes de que alguien lo copie. */}
              {esLocal && (
                <Aviso>
                  Este enlace apunta a tu máquina y <b>no le va a funcionar a ningún chofer</b>.
                  Falta cargar <code className="font-mono text-[12px]">NEXT_PUBLIC_APP_URL</code> con
                  el dominio del sistema. Copialo desde producción, no desde acá.
                </Aviso>
              )}

              {/* El mensaje, listo para pegar en el grupo */}
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Para el grupo de WhatsApp
                </div>
                {/* `break-words` no es cosmético: la URL lleva el token pegado y
                    sin un punto donde cortar. Sin esto, esa sola palabra le fija
                    al diálogo un ancho mínimo mayor que el de la pantalla y se
                    desborda todo el contenido, botones incluidos. */}
                <p className="whitespace-pre-line break-words rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                  {mensaje}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => copiar("mensaje")}>
                    {copiado === "mensaje" ? <Check size={14} /> : <Copy size={14} />}
                    {copiado === "mensaje" ? "Copiado" : "Copiar el mensaje"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copiar("url")}>
                    {copiado === "url" ? <Check size={14} /> : <Copy size={14} />}
                    {copiado === "url" ? "Copiado" : "Copiar sólo el enlace"}
                  </Button>
                </div>
              </div>

              {/* Uno por uno */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    O mandáselo a uno
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {datos.choferes.length} choferes
                    {sinWhatsapp > 0 ? ` · ${sinWhatsapp} sin teléfono usable` : ""}
                  </span>
                </div>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre"
                    className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                  {lista.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">
                      Nadie con ese nombre.
                    </p>
                  ) : (
                    lista.map((c) => {
                      const wa = linkWhatsapp(c.telefono, mensaje);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <span className="truncate text-[13px] text-foreground">{c.nombre}</span>
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/60"
                            >
                              <Send size={12} />
                              WhatsApp
                            </a>
                          ) : (
                            // Sin teléfono usable no se ofrece un botón que abre
                            // un chat vacío: se dice qué falta.
                            <span className="shrink-0 text-[12px] text-muted-foreground">
                              Sin teléfono cargado
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {error && <Aviso tono="error">{error}</Aviso>}

              {puedeRotar && (
                <div className="border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmarRotar(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshCw size={12} />
                    Dar de baja este enlace y generar otro
                  </button>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Sirve si el enlace llegó a donde no tenía que llegar. Deja de andar el que
                    tienen guardado los choferes y hay que volver a mandarlo.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmarRotar}
        onOpenChange={setConfirmarRotar}
        title="¿Generar un enlace nuevo?"
        description={`El que tienen guardado los ${datos?.choferes.length ?? 0} choferes deja de funcionar en el acto: al abrirlo les va a decir que ya no sirve. Vas a tener que mandarles el nuevo.`}
        confirmLabel={rotando ? "Generando…" : "Sí, generar otro"}
        onConfirm={rotar}
        loading={rotando}
        destructive
      />
    </>
  );
}

/** Un aviso corto adentro del diálogo. `InlineFeedback` sólo tiene éxito y error
 *  y se auto-oculta; acá hace falta que quede a la vista y admita un `<code>`. */
function Aviso({
  children,
  tono = "atencion",
}: {
  children: React.ReactNode;
  tono?: "atencion" | "error";
}) {
  const estilo =
    tono === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${estilo}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
