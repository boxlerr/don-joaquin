import Link from "next/link";
import { CalendarOff, ChevronRight } from "lucide-react";
import AvatarPersona from "@/components/ui/AvatarPersona";
import {
  cuandoSeVa,
  estadoAusente,
  fechaCorta,
  fechaCortaConDia,
  motivoAusencia,
} from "@/lib/ausencias-texto";
import type { AusenciaProxima } from "@/app/(dashboard)/viajes/actions";

interface Props {
  ausencias: AusenciaProxima[];
  /** Ventana en días de la que salen los que "se van pronto". */
  dias: number;
  /**
   * La tarjeta la ve todo el equipo, pero el cronograma de vacaciones y los
   * legajos son secciones con permiso propio: a quien no las tiene no se le
   * dibuja el link. Mostrarle un botón que le rebota es peor que no mostrarlo.
   */
  puedeVerCronograma: boolean;
  puedeVerLegajos: boolean;
}

/** Cuántas personas entran antes de mandar al cronograma. Con la flota entera de
 *  vacaciones en enero esta tarjeta sería media pantalla; el resto se cuenta. */
const MAX_VISIBLES = 6;

/**
 * Una persona de la lista. Dos niveles: el nombre, y abajo en gris qué le pasa.
 * Con permiso de legajos la fila entera es un link al legajo, que es donde se
 * corrige la ausencia; sin permiso es la misma ficha, pero quieta.
 */
function Ficha({ a, conLink }: { a: AusenciaProxima; conLink: boolean }) {
  const Contenedor = conLink ? Link : "div";
  return (
    <Contenedor
      href={`/choferes/${a.chofer_id}?tab=ausencias`}
      className={`group flex items-center gap-3 rounded-[8px] border border-border px-3 py-2.5 ${
        conLink ? "transition-colors hover:border-primary/40 hover:bg-muted/30" : ""
      }`}
    >
      <AvatarPersona name={a.chofer_nombre} rol="chofer" size={34} className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {a.chofer_nombre}
        </p>

        {a.en_curso ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight">
            <span className="size-1.5 shrink-0 rounded-full bg-[#F59E0B]" aria-hidden />
            {/* El separador va pegado al estado y no al detalle: si la línea
                envuelve, un renglón que empieza con "·" se lee como un error. */}
            <span className="font-semibold text-[#B45309]">
              {estadoAusente(a.tipo, a.es_vacaciones)} ·
            </span>
            <span className="text-muted-foreground">
              vuelve el {fechaCortaConDia(a.fecha_regreso)}
              {a.fecha_aproximada && " (estimado)"}
            </span>
          </p>
        ) : (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight">
            <span
              className="size-1.5 shrink-0 rounded-full border border-muted-foreground/50"
              aria-hidden
            />
            <span className="font-semibold text-foreground/70">
              Se va {cuandoSeVa(a.dias_hasta_inicio)} ·
            </span>
            <span className="text-muted-foreground">
              {motivoAusencia(a.tipo, a.es_vacaciones).toLowerCase()} · {fechaCorta(a.fecha_inicio)}
              {a.fecha_inicio !== a.fecha_fin && ` – ${fechaCorta(a.fecha_fin)}`}
            </span>
          </p>
        )}
      </div>

      {conLink && (
        <ChevronRight
          size={14}
          className="shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      )}
    </Contenedor>
  );
}

/**
 * Un grupo con su rótulo. Las columnas se achican a la cantidad de gente: con
 * una sola persona, tres columnas dejaban dos tercios de tarjeta en blanco.
 */
function Grupo({
  titulo,
  items,
  conLink,
}: {
  titulo: string;
  items: AusenciaProxima[];
  conLink: boolean;
}) {
  if (items.length === 0) return null;
  const columnas =
    items.length === 1 ? "" : items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";
  return (
    <div>
      <p className="pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {titulo} · {items.length}
      </p>
      <div className={`grid grid-cols-1 gap-2 ${columnas}`}>
        {items.map((a) => (
          <Ficha key={a.id} a={a} conLink={conLink} />
        ))}
      </div>
    </div>
  );
}

/**
 * Quién no está: vacaciones y días pedidos, la misma información que la tarjeta
 * de disponibilidad de /viajes pero resumida para el tablero.
 *
 * Va acá porque es la otra mitad de "con qué cuento hoy": al lado de cuántas
 * unidades están en servicio hace falta saber cuántos choferes hay para
 * manejarlas. Primero los que hoy no están —los que hay que reemplazar— y
 * después los que se van en los próximos días, que todavía pueden salir a hacer
 * un viaje.
 */
export default function QuienNoEsta({
  ausencias,
  dias,
  puedeVerCronograma,
  puedeVerLegajos,
}: Props) {
  const hoyNoEstan = ausencias.filter((a) => a.en_curso);
  const seVan = ausencias.filter((a) => !a.en_curso);

  // El recorte deja siempre primero a los que hoy no están: si hay diez que se
  // van la semana que viene, no pueden tapar al que falta hoy.
  const visiblesHoy = hoyNoEstan.slice(0, MAX_VISIBLES);
  const visiblesSeVan = seVan.slice(0, Math.max(0, MAX_VISIBLES - visiblesHoy.length));
  const ocultos = ausencias.length - visiblesHoy.length - visiblesSeVan.length;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarOff size={16} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-tight text-foreground">Quién no está</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Vacaciones y días pedidos · próximos {dias} días
            </p>
          </div>
        </div>
        {puedeVerCronograma && (
          <Link
            href="/choferes/vacaciones"
            className="inline-flex shrink-0 items-center max-md:h-9 text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
          >
            Ver vacaciones →
          </Link>
        )}
      </div>

      {ausencias.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground sm:px-5">
          Hoy no falta nadie: no hay vacaciones ni días pedidos en los próximos {dias} días.
        </p>
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          <Grupo titulo="Hoy no están" items={visiblesHoy} conLink={puedeVerLegajos} />
          <Grupo titulo="Se van en los próximos días" items={visiblesSeVan} conLink={puedeVerLegajos} />

          {ocultos > 0 &&
            (puedeVerCronograma ? (
              <Link
                href="/choferes/vacaciones"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Ver {ocultos} más en el cronograma
                <ChevronRight size={14} />
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                Y {ocultos} más en los próximos {dias} días.
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
