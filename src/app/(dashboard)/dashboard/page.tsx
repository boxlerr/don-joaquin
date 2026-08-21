import DashboardView from "./DashboardView";
import DashboardHelpButton from "./DashboardHelpButton";

/**
 * El dashboard, uno solo para todo el equipo.
 *
 * Hasta el 21/08/2026 eran dos pantallas: ésta sin montos y `/dashboard/completo`
 * con la facturación, que ocupaba una entrada entera del menú para un puñado de
 * números. Ahora es la misma: quien tiene el permiso ve además la facturación
 * del período, el $/km y los montos por chofer, y el resto del equipo ve el
 * mismo tablero sin un solo importe. `/dashboard/completo` redirige acá.
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
        titulo="Dashboard"
        subtitulo="Resumen operativo y financiero del día"
        accionExtra={<DashboardHelpButton />}
      />
    </div>
  );
}
