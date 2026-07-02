import PageHeader from "@/components/layout/PageHeader";
import { Lock } from "lucide-react";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import MesSelector from "../combustible/components/MesSelector";
import { getSueldosAdminResumenAction } from "./actions";
import SueldosAdminClient from "./SueldosAdminClient";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function SueldosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Sección sensible: sueldos del personal de administración y taller.
  // Confidencial como la liquidación de choferes — solo dirección.
  const user = await requireSeccion("sueldos_admin", "read");
  const canWrite = hasSeccion(user, "sueldos_admin", "write");

  const { month = "" } = await searchParams;
  const resumen = await getSueldosAdminResumenAction(month);

  let periodLabel = "del mes en curso";
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-");
    periodLabel = `de ${MESES[parseInt(m, 10) - 1]} ${y}`;
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Sueldos admin y taller"
        description={`Planilla ${periodLabel} — sueldos de administración y taller como % de la facturación`}
        action={<MesSelector currentMonth={month} />}
      />

      <div className="flex items-start gap-3 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3">
        <Lock size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <p className="font-semibold">Sección privada — solo dirección.</p>
          <p className="mt-0.5">
            Acá se carga el <strong>sueldo base</strong> (con su historial de aumentos), las{" "}
            <strong>horas extras</strong> y algún <strong>plus</strong> del personal de
            administración y taller. El total del mes se compara contra la{" "}
            <strong>facturación</strong> para ver qué porcentaje se lleva. NO es la liquidación
            de choferes: esa vive en Choferes → Sueldos.
          </p>
        </div>
      </div>

      <SueldosAdminClient resumen={resumen} month={month} canWrite={canWrite} />
    </div>
  );
}
