import { redirect } from "next/navigation";

/**
 * "Negocio" dejó de ser una subsección aparte: los datos de la empresa ahora
 * viven en Configuración → General (ficha "Datos de la empresa"). Se mantiene
 * la ruta como redirect para no romper enlaces ni marcadores viejos.
 */
export default function ConfiguracionNegocioPage() {
  redirect("/configuracion");
}
