import PageHeader from "@/components/layout/PageHeader";
import DashboardView from "./DashboardView";
import DashboardHelpButton from "./DashboardHelpButton";

/**
 * Dashboard general (de entrada): mismo cuerpo que /dashboard/completo pero SIN
 * montos de facturación. Bárbara pidió que la plata no esté "servida en bandeja"
 * para todo el que entra; los importes viven en /dashboard/completo (solo dirección).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      <PageHeader
        title="Dashboard"
        description="Resumen operativo y financiero del día"
        action={<DashboardHelpButton />}
      />
      <DashboardView sp={await searchParams} conFacturacion={false} />
    </div>
  );
}
