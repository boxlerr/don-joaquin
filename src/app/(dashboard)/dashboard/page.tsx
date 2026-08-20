import DashboardView from "./DashboardView";
import DashboardHelpButton from "./DashboardHelpButton";

/**
 * Dashboard general (de entrada): mismo cuerpo que /dashboard/completo pero SIN
 * montos de facturación. Bárbara pidió que la plata no esté "servida en bandeja"
 * para todo el que entra; los importes viven en /dashboard/completo (solo dirección).
 *
 * Sin padding propio: el encabezado con la foto llega a los bordes de la
 * pantalla y el padding lo pone el cuerpo, ya dentro de DashboardView.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}) {
  return (
    <div className="w-full">
      <DashboardView
        sp={await searchParams}
        conFacturacion={false}
        titulo="Dashboard"
        subtitulo="Resumen operativo y financiero del día"
        accionExtra={<DashboardHelpButton />}
      />
    </div>
  );
}
