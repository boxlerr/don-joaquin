import PageHeader from "@/components/layout/PageHeader";
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

      <SueldosAdminClient resumen={resumen} month={month} canWrite={canWrite} />
    </div>
  );
}
