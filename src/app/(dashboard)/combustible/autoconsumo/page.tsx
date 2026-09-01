import PageHeader from "@/components/layout/PageHeader";
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
