import PageHeader from "@/components/layout/PageHeader";
import { Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import MesSelector from "../../combustible/components/MesSelector";
import { getSueldosResumenAction } from "./actions";
import SueldosClient from "./SueldosClient";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function SueldosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Sección sensible: solo dirección (rol admin). Bárbara pidió que no esté a la vista de todos.
  await requireAdmin();

  const { month = "" } = await searchParams;
  const resumen = await getSueldosResumenAction(month);

  let periodLabel = "del mes en curso";
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-");
    periodLabel = `de ${MESES[parseInt(m, 10) - 1]} ${y}`;
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Sueldos"
        description={`Totales por chofer ${periodLabel} — base para liquidar`}
        action={<MesSelector currentMonth={month} />}
      />

      <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
        <Lock size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-semibold">Sección privada — solo dirección.</p>
          <p className="mt-0.5">
            El sistema arma los <strong>totales por chofer</strong> desde la hoja de ruta
            (viajes, km, toneladas) y discrimina <strong>al sur</strong> y <strong>zona
            petrolera/pozo</strong> según el marcado de cada viaje. Lo que <strong>falta</strong>:
            las <strong>tarifas por concepto</strong> (las define Bárbara) para calcular el monto en $,
            y los conceptos no automatizables (estadías &gt;24 hs, etc.) se cargan a mano.
          </p>
        </div>
      </div>

      <SueldosClient resumen={resumen} month={month} />
    </div>
  );
}
