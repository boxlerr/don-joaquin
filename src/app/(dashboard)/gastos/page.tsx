import { redirect } from "next/navigation";

/**
 * Gastos dejó de ser una sección propia del sidebar: es un tipo de egreso de la
 * caja, así que ahora vive como solapa dentro de Caja (/caja/gastos).
 *
 * La ruta vieja queda como redirect para no romper links guardados ni accesos
 * directos (mismo criterio que se usó al unificar Compliance).
 *
 * OJO: la carpeta sigue existiendo porque `actions.ts` y `components/` son el
 * módulo de gastos compartido — los importan también Viajes y Camiones para el
 * panel de gastos de cada viaje/camión. Acá solo se movió la PANTALLA.
 */
export default async function GastosPage() {
  redirect("/caja/gastos");
}
