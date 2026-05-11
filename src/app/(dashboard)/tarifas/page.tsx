import PageHeader from "@/components/layout/PageHeader";
import CalculadoraFlete from "./CalculadoraFlete";
import AjustesTarifa from "./AjustesTarifa";
import { getTarifaParams } from "./actions";

export default async function TarifasPage() {
  const params = await getTarifaParams();

  return (
    <div className="p-8">
      <PageHeader title="Tarifas" description="Calculadora y configuración de precios" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <CalculadoraFlete params={params} />
        <AjustesTarifa params={params} />
      </div>
    </div>
  );
}
