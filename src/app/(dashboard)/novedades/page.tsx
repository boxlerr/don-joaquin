import PageHeader from "@/components/layout/PageHeader";
import { requireUser } from "@/lib/auth";
import { NOVEDADES, novedadesVisibles } from "@/lib/novedades";
import NovedadesView from "./NovedadesView";

/**
 * El historial de novedades del sistema.
 *
 * El pop-up de la mañana muestra las que cada uno todavía no vio y como mucho
 * cuatro: es un cartel de paso, no un archivo. Acá está todo, de lo más nuevo a
 * lo más viejo, para el que entró de vacaciones o el que quiere buscar cuándo
 * cambió algo.
 *
 * No pide ningún permiso para entrar —cualquiera que use el sistema puede leer
 * qué cambió—, pero la LISTA sí se filtra: cada novedad declara qué sección o
 * área hay que tener (ver `NovedadAlcance`), y el filtro corre en el server, así
 * que al navegador no le llega ni el título de una pantalla que esta persona no
 * puede abrir.
 */
export default async function NovedadesPage() {
  const user = await requireUser();

  const items = novedadesVisibles(NOVEDADES, {
    secciones: user.secciones,
    areas: user.permisos,
  }).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Novedades del sistema"
        description="Todo lo que fue cambiando, de lo más nuevo a lo más viejo"
      />
      <NovedadesView items={items} />
    </div>
  );
}
