import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { hasSeccion, requireSeccion } from "@/lib/auth";
import ResumenDestinosClient from "../ResumenDestinosClient";
import { resumenMockup } from "./datos";

/**
 * Cómo se vería "A dónde fueron" con la programación recién importada.
 *
 * Existe SÓLO en desarrollo: en producción devuelve 404, así que no hay forma de
 * que alguien de la oficina caiga acá y confunda estos 8 viajes con datos reales.
 *
 * Los datos están escritos a mano (ver `datos.ts`) y no salen ni entran a la
 * base. Se hizo así porque `localhost` escribe en la base de producción —no hay
 * base local— y esos 8 viajes ya están cargados por otra vía, así que importarlos
 * de verdad habría duplicado viajes reales.
 */
export default async function MockupResumenPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const user = await requireSeccion("viajes_listado", "read");
  const canWrite = hasSeccion(user, "viajes_listado", "write");
  const datos = resumenMockup();

  return (
    <div className="w-full space-y-6 p-8">
      <PageHeader
        title="A dónde fueron — cómo se vería importado"
        description="Los 8 viajes del Prog.Viajes.XLSX del 28 y 29/07, tal como quedarían al importarlos"
      />

      <div className="space-y-2 rounded-[8px] border-2 border-[#B45309]/50 bg-[#B45309]/[0.06] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-[#B45309]">
          <AlertTriangle size={15} />
          Es un mockup: nada de esto está en la base
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/80">
          Los 8 viajes están escritos a mano en el código, con las mismas reglas que aplica el
          importador: el <b>Centro</b> del Excel (A111 / A109) entra como origen, el destinatario
          como destino, los kilos pasan a toneladas y el <b>chofer queda vacío</b> — que es el único
          dato que el archivo no trae.
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/80">
          No se importaron de verdad por dos razones: <b>localhost escribe en la base de producción</b>{" "}
          (no hay base local), y esos 8 viajes <b>ya están cargados</b> por otra vía — el circuito
          61753 es RAMALLO→LOMASER del 29/07, que ese día ya tiene 3 viajes con chofer puesto. Habrían
          quedado duplicados.
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/80">
          Los botones de guardar y de asignar chofer no van a hacer nada: estos viajes no existen,
          así que la base los rechaza. La pantalla es la de verdad, los datos no.
        </p>
        <Link
          href="/viajes/resumen"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={13} /> Volver al resumen real
        </Link>
      </div>

      <ResumenDestinosClient inicial={datos} hoy="2026-07-29" canWrite={canWrite} />
    </div>
  );
}
