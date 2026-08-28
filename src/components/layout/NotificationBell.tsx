"use client";

import { useState, useEffect, useRef, useContext, useSyncExternalStore } from "react";
import { Bell, Check, CheckCheck, ChevronRight, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { NotificacionesContext } from "@/components/notificaciones/NotificacionesProvider";
import type { Severidad } from "@/app/(dashboard)/notificaciones/utils";
import {
  setSonidoActivo,
  sonarAviso,
  sonidoActivo,
  sonidoActivoEnServidor,
  suscribirSonido,
} from "@/lib/sonido-aviso";
import { colorCategoria, ICONO_CATEGORIA, textoSobre } from "@/lib/alertas-ui";

const severidadDot: Record<Severidad, string> = {
  critica: "bg-[#EF4444]",
  advertencia: "bg-[#F59E0B]",
  info: "bg-[#0088D1]",
};

// Color del badge según la severidad más alta sin leer (rojo > ámbar > marca).
const badgeColor: Record<Severidad, string> = {
  critica: "bg-[#EF4444]",
  advertencia: "bg-[#F59E0B]",
  info: "bg-[#0088D1]",
};
const pingColor: Record<Severidad, string> = {
  critica: "bg-[#F87171]",
  advertencia: "bg-[#FBBF24]",
  info: "bg-[#38BDF8]",
};
const SEV_RANK: Record<Severidad, number> = { critica: 3, advertencia: 2, info: 1 };

export default function NotificationBell({ initialCount }: { initialCount: number }) {
  const ctx = useContext(NotificacionesContext);
  const [open, setOpen] = useState(false);
  // La preferencia del sonido vive en localStorage, que en el server no existe:
  // se lee con un store externo para que el primer render del navegador coincida
  // con el del server y no rompa la hidratación.
  const conSonido = useSyncExternalStore(suscribirSonido, sonidoActivo, sonidoActivoEnServidor);
  const ref = useRef<HTMLDivElement>(null);

  // Sin provider (caso degradado sin sesión): ícono estático con el conteo inicial.
  const count = ctx?.count ?? initialCount;
  const items = ctx?.items ?? [];
  const loading = ctx?.loading ?? false;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Severidad dominante para teñir el badge/halo. Mientras no llegó el primer poll
  // (items vacíos), caemos a "info" (azul de marca) para no mostrar un rojo "crítico"
  // falso en cada carga; al resolver el poll se ajusta a la severidad real.
  const sevMax: Severidad = items.reduce<Severidad>(
    (acc, it) => (SEV_RANK[it.severidad] > SEV_RANK[acc] ? it.severidad : acc),
    "info",
  );

  const handleOpen = () => {
    const willOpen = !open;
    setOpen(willOpen);
    // El refresh dispara setState en el provider: debe correr en el handler del
    // click, nunca dentro del updater de setOpen (React lo ejecuta en render).
    if (willOpen) ctx?.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          count > 0
            ? "bg-brand-50 text-primary hover:bg-brand-100"
            : "text-muted-foreground hover:bg-muted hover:text-primary"
        }`}
        aria-label={count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones"}
      >
        {/* key={count} re-dispara el balanceo de una pasada cuando entra algo nuevo */}
        <Bell
          key={count}
          size={18}
          className={count > 0 && !open ? "motion-safe:animate-[wiggle_0.7s_ease-in-out_1]" : undefined}
        />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            {!open && (
              <span
                className={`absolute inline-flex w-full h-full rounded-full opacity-75 motion-safe:animate-ping [animation-iteration-count:3] ${pingColor[sevMax]}`}
              />
            )}
            {/* El número entero, no "9+": con 9+ nadie sabe si son diez o
                ciento cuarenta, que es justo lo que hay que saber para decidir
                si vale la pena abrir (Julián, 27/08/2026). El `px` acompaña al
                largo y `tabular-nums` evita que el badge tiemble al cambiar. */}
            <span
              className={`relative flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full ring-2 ring-card text-white text-[10px] font-bold leading-none tabular-nums ${badgeColor[sevMax]}`}
            >
              {count}
            </span>
          </span>
        )}
      </button>

      {open && (
        // Los 320px del panel no entran en un celular angosto (320px de
        // pantalla): se clampea al ancho disponible menos el margen.
        <div className="absolute right-0 top-10 z-50 w-80 max-w-[calc(100vw-1.5rem)] bg-card rounded-xl border border-border shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Notificaciones</span>
            <div className="flex items-center gap-1">
              {/* Prender y apagar el sonido de los avisos. La preferencia es del
                  DISPOSITIVO: depende de si estás en la oficina o en el teléfono
                  en una reunión, no de quién sos. Al prenderlo suena una vez —es
                  el gesto que además desbloquea el audio del navegador. */}
              <button
                type="button"
                onClick={() => {
                  const proximo = !conSonido;
                  setSonidoActivo(proximo);
                  if (proximo) sonarAviso();
                }}
                aria-pressed={conSonido}
                title={conSonido ? "Silenciar los avisos" : "Que los avisos suenen"}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                {conSonido ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span className="sr-only">
                  {conSonido ? "Silenciar los avisos" : "Que los avisos suenen"}
                </span>
              </button>
            {/* Sólo si hay alguna que se pueda marcar: con un único aviso en vivo
                —el cheque por depositar— el botón no habría apagado nada. */}
            {items.some((i) => i.marcable !== false) && (
              <button
                type="button"
                onClick={() => {
                  ctx?.marcarTodas();
                  setOpen(false);
                }}
                className="flex items-center gap-1 text-xs text-primary hover:text-[#0069A5] font-medium"
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
            </div>
          </div>

          <div className="max-h-[60dvh] sm:max-h-72 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/70">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground/70">
                Sin alertas pendientes
              </div>
            ) : (
              items.map((item) => {
                // El ícono de la categoría, con su color: el mismo del resumen
                // del día y del grupo del menú. Antes era un punto de color por
                // severidad, que en una lista de ocho renglones se leía como
                // ocho puntos iguales. La urgencia ya la dice el texto ("venció
                // hace 43 días") y el badge de la campana.
                const Icono = item.categoria ? ICONO_CATEGORIA[item.categoria] : undefined;
                const colorCat = item.categoria ? colorCategoria(item.categoria) : null;
                const content = (
                  <>
                    {Icono && colorCat ? (
                      <span
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: colorCat, color: textoSobre(colorCat) }}
                      >
                        <Icono size={13} />
                      </span>
                    ) : (
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severidadDot[item.severidad]}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.mensaje}</p>
                      {item.href && (
                        <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary/70 group-hover:text-primary transition-colors">
                          Ir <ChevronRight size={12} />
                        </span>
                      )}
                    </div>
                  </>
                );
                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40 border-b border-[#F1F5F9] last:border-0"
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          ctx?.marcarVista(item.id);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          ctx?.marcarVista(item.id);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      >
                        {content}
                      </button>
                    )}
                    {/* El aviso en vivo no se marca leído: se apaga haciendo lo
                        que pide (depositar o ceder el cheque). Ofrecer el tilde
                        sería ofrecer un botón que no hace nada. */}
                    {item.marcable !== false && (
                      <button
                        type="button"
                        onClick={() => ctx?.marcarVista(item.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded text-muted-foreground/70 hover:text-primary hover:bg-[#E1F5FE] transition-all shrink-0 mt-0.5"
                        aria-label="Marcar como vista"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/40">
              <a
                href="/notificaciones"
                className="block text-center text-xs text-primary hover:text-[#0069A5] font-medium"
                onClick={() => setOpen(false)}
              >
                Ver todas las alertas
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
