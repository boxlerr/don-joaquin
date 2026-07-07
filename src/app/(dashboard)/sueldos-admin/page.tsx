import { redirect } from "next/navigation";

// La sección se unificó en "Sueldos" (/choferes/sueldos, pestaña "Admin y taller").
// Se conserva esta ruta como redirect para links/marcadores viejos.
export default async function SueldosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  redirect(`/choferes/sueldos${month ? `?month=${encodeURIComponent(month)}` : ""}`);
}
