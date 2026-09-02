import { requireArea } from "@/lib/auth";
import { getReporteAutoconsumoAction } from "@/app/(dashboard)/combustible/autoconsumo/actions";
import PrintTrigger from "@/app/(print)/_components/PrintTrigger";
import { HojaAutoconsumo, nombreDelMes } from "./hoja";

export const dynamic = "force-dynamic";

/**
 * El reporte de autoconsumo, con nuestra marca, para presentarle a YPF.
 *
 * Sigue el cuadro que manda YPF —cantera → locación → toneladas → litros
 * teóricos, y el desvío contra lo cargado— porque el que lo recibe ya sabe leer
 * ese formato, y agrega los cortes que del lado de ellos no existen: el día a día
 * del mes, el acumulado de las dos series y quién manejó cada vuelta. Lo que
 * cambia es de qué lado sale el papel: éste lo emitimos nosotros.
 *
 * Acá sólo van los permisos y los datos; cómo se ve la hoja está en `./hoja`.
 */

function mesActualAr(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AutoconsumoPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; preview?: string }>;
}) {
  await requireArea("combustible", "read");
  const { mes: mesParam, preview } = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesActualAr();
  const r = await getReporteAutoconsumoAction(mes);

  const emitido = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="doc">
      {/* `?preview=1` deja mirar la hoja sin que salte el diálogo de impresión.
          Sirve para revisarla antes de mandarla —es un papel que sale de la
          empresa— y para poder verla desde una automatización, que con el
          diálogo abierto no puede hacer nada. */}
      {preview !== "1" && <PrintTrigger title={`Autoconsumo - ${nombreDelMes(mes)}`} />}
      <HojaAutoconsumo r={r} mes={mes} emitido={emitido} />
    </div>
  );
}
