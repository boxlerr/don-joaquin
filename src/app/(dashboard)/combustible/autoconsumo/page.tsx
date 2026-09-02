import Link from "next/link";
import { Printer } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import BotonEnviarEnlace from "./BotonEnviarEnlace";
import { requireArea, hasArea } from "@/lib/auth";
import {
  getAutorizacionesAction,
  getChoferesParaGasoilAction,
  getTarifasGasoilAction,
} from "./actions";
import AutoconsumoClient from "./AutoconsumoClient";

/**
 * Autoconsumo — pedido de Nico por WhatsApp del 31/08/2026.
 *
 * Vive dentro de Combustible porque es gasoil, y no en Viajes: lo que se decide
 * acá es cuánto puede cargar el camión en el surtidor, no qué viaje hizo.
 */
export default async function AutoconsumoPage() {
  const user = await requireArea("combustible", "read");
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const canWrite = hasArea(user, "combustible", "write");

  const [tarifas, choferes, autorizaciones] = await Promise.all([
    getTarifasGasoilAction(),
    getChoferesParaGasoilAction(),
    getAutorizacionesAction(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Autoconsumo"
        description="Cuánto gasoil le corresponde según las toneladas que cargó. Es la misma cuenta que usa YPF."
        action={
          <div className="flex items-center gap-2">
            <BotonEnviarEnlace puedeRotar={canWrite} />
            {/* Un Link con pinta de botón, no un Button adentro de un Link: un
                <button> dentro de un <a> no es HTML válido. Abre en pestaña nueva
                porque la hoja dispara el diálogo de impresión sola al cargar. */}
            <Link
              href={`/combustible/autoconsumo/print?mes=${mesActual}`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              <Printer size={14} />
              Reporte para YPF
            </Link>
          </div>
        }
      />
      {tarifas.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">Todavía no hay ningún tramo cargado.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Falta correr la migración <code>20260901_gasoil_litros_por_tonelada.sql</code>, que deja
            los doce tramos del cuadro que pasó Nico.
          </p>
        </div>
      ) : (
        <AutoconsumoClient
          tarifas={tarifas}
          choferes={choferes}
          autorizaciones={autorizaciones}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
