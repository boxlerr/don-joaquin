import { notFound } from "next/navigation";
import { requireArea, hasArea } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganismoChecklistAction } from "../actions";
import OrganismoChecklistPage from "../OrganismoChecklistPage";
import type { ComplianceDestinatario } from "../../types";

export default async function ComplianceOrganismoPage({
  params,
}: {
  params: Promise<{ organismo: string }>;
}) {
  const { organismo: slug } = await params;

  const user = await requireArea("compliance", "read");
  const canWrite = hasArea(user, "compliance", "write");

  // Usar `as any` porque `compliance_destinatarios` aún no está en database.ts
  // Se actualiza al regenerar los tipos tras aplicar la migración
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Resolver el slug (código) al id del destinatario
  const { data: dest } = await supabase
    .from("compliance_destinatarios")
    .select("id, codigo, nombre, descripcion, orden, activo")
    .eq("activo", true)
    .ilike("codigo", slug)   // slug es el código en minúsculas (ej: "sicop")
    .single() as { data: ComplianceDestinatario | null };

  if (!dest) notFound();

  const { destinatario, rows } = await getOrganismoChecklistAction(dest.id);

  if (!destinatario) notFound();

  return (
    <OrganismoChecklistPage
      destinatario={destinatario}
      rows={rows}
      canWrite={canWrite}
    />
  );
}
