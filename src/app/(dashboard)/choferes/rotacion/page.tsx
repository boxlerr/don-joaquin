import { requireSeccion, hasSeccion } from "@/lib/auth";
import { getRotacionDataset } from "./lib";
import RotacionClient from "./RotacionClient";

export default async function RotacionChoferes({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const user = await requireSeccion("choferes_rotacion", "read");
  const canWrite = hasSeccion(user, "choferes_rotacion", "write");
  const dataset = await getRotacionDataset();

  const { anio: anioParam } = await searchParams;
  const anioInicial =
    anioParam && /^\d{4}$/.test(anioParam) && dataset.anios.includes(Number(anioParam))
      ? Number(anioParam)
      : dataset.anios[0] ?? new Date().getFullYear();

  return <RotacionClient dataset={dataset} canWrite={canWrite} anioInicial={anioInicial} />;
}
