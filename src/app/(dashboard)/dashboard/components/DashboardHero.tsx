import type { ReactNode } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";

interface Props {
  /** Nombre de pila del usuario logueado; si no hay, se saluda sin nombre. */
  nombre: string | null;
  /** Rótulo chico arriba del saludo ("Dashboard"). */
  titulo: string;
  subtitulo: string;
  /** Selector de período y accesos rápidos, a la derecha del saludo. */
  acciones?: ReactNode;
}

const TZ = "America/Argentina/Buenos_Aires";

/**
 * La hora se resuelve en el server con el huso de Argentina —fijo, sin horario
 * de verano—, así el saludo y la fecha son los mismos para todos y no hace
 * falta mandar un reloj al navegador ni convivir con un parpadeo de hidratación.
 */
function ahoraEnArgentina() {
  const d = new Date();
  const hora = Number(
    d.toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }),
  );
  const fecha = d.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const reloj = d.toLocaleTimeString("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return { hora, fecha, reloj };
}

function saludoDe(hora: number): string {
  if (hora < 6) return "Buenas noches";
  if (hora < 13) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Encabezado del dashboard: la foto de la flota ocupa todo el ancho de la
 * pantalla, pegada a la barra de arriba, y se funde con el fondo de la página
 * por abajo. No es una tarjeta con la foto adentro: la foto ES el encabezado,
 * y por eso no lleva marco, ni esquinas redondeadas, ni sombra.
 */
export default function DashboardHero({ nombre, titulo, subtitulo, acciones }: Props) {
  const { hora, fecha, reloj } = ahoraEnArgentina();
  const saludo = saludoDe(hora);
  // "jueves 20 de agosto de 2026" → "Jueves 20 de agosto de 2026".
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return (
    <section className="relative min-h-[186px] w-full sm:min-h-[204px] lg:min-h-[224px]">
      {/* El fondo se recorta acá adentro y NO en la sección: el selector de
          período abre un popover que cuelga del borde de abajo, y un
          `overflow-hidden` en la sección se lo comía. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorativa y fija: no hay nada que optimizar */}
        <img
          src="/dashboard/ruta-sierras.jpg"
          alt=""
          aria-hidden
          fetchPriority="high"
          // En celular la banda es angosta y el recorte pasa a ser horizontal: con el
          // encuadre centrado el camión quedaba fuera de cuadro y sobraba valle.
          className="h-full w-full object-cover object-[82%_62%] sm:object-[center_72%]"
        />
        {/* Tres capas, y no una sola cortina azul: la foto tiene que verse.
            1) un velo parejo mínimo, que unifica el color;
            2) un degradé lateral que se apaga antes de llegar al camión;
            3) una mancha oscura sobre el vértice inferior izquierdo, que es lo
               único que necesita contraste porque ahí va el saludo. */}
        <div className="absolute inset-0 bg-[#001B36]/18" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(92deg, rgba(0,22,44,0.80) 0%, rgba(0,34,66,0.56) 22%, rgba(0,52,96,0.26) 46%, rgba(0,80,130,0.06) 68%, rgba(0,90,140,0) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(78% 118% at 2% 82%, rgba(0,16,34,0.86) 0%, rgba(0,19,40,0.58) 38%, rgba(0,22,46,0.22) 68%, rgba(0,24,50,0) 100%)",
          }}
        />
        {/* Y una sombra sobre el borde derecho, donde se apoyan las chapas del
            período: sin esto quedaban blancas sobre el acoplado blanco. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(270deg, rgba(0,20,42,0.62) 0%, rgba(0,20,42,0.30) 14%, rgba(0,20,42,0) 34%)",
          }}
        />
        {/* Fundido de abajo hacia el fondo de la página: la foto no termina en
            un borde, se deshace en el color del tablero. */}
        <div
          className="absolute inset-x-0 bottom-0 h-12"
          style={{
            background:
              "linear-gradient(to bottom, rgba(248,250,252,0) 0%, rgba(248,250,252,0.42) 58%, #F8FAFC 100%)",
          }}
        />
      </div>

      {/* `z-10` para quedar por encima del fondo y, de paso, para que el popover
          del selector se dibuje arriba de las tarjetas que siguen. */}
      <div className="relative z-10 flex min-h-[186px] flex-col justify-center gap-4 px-4 pb-7 pt-5 sm:min-h-[204px] sm:px-6 sm:pb-8 sm:pt-6 lg:min-h-[224px] lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-1 shrink-0 rounded-full bg-[#FFB300]" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/75">
              {titulo}
            </span>
          </div>

          <h1 className="mt-2 text-[24px] font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,20,40,0.5)] sm:text-[30px]">
            ¡{saludo}
            {nombre ? `, ${nombre}` : ""}!{" "}
            <span className="inline-block align-middle" aria-hidden>
              👋
            </span>
          </h1>

          <p className="mt-1 text-[13px] text-white/85 sm:text-sm">{subtitulo}</p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
              <CalendarDays size={12} strokeWidth={2.4} />
              {fechaCap}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm">
              <RefreshCw size={11} strokeWidth={2.4} />
              Actualizado {reloj}
            </span>
          </div>
        </div>

        {/* Las chapas se apoyan ARRIBA a la derecha, no al medio: centradas
            caían justo sobre el acoplado y le tapaban el logo al camión. */}
        {acciones && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto lg:justify-end lg:self-start">
            {acciones}
          </div>
        )}
      </div>
    </section>
  );
}
