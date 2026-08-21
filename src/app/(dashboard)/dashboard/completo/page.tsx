import { redirect } from "next/navigation";

/**
 * El "dashboard completo" ya no existe como pantalla aparte (21/08/2026).
 *
 * Era el mismo tablero con la facturación a la vista, y tener una entrada
 * propia en el menú —más un cartel de "vista privada"— para eso solo era mucho
 * ruido: ahora los importes se muestran en `/dashboard` a quien tenga el
 * permiso `dashboard_completo` (hoy, la dirección).
 *
 * Queda la redirección porque la ruta anduvo un mes: hay favoritos, links en
 * las novedades y correos que apuntan acá.
 */
export default function DashboardCompletoPage() {
  redirect("/dashboard");
}
