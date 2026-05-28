import { notFound, redirect } from "next/navigation";
import { requireArea, hasArea } from "@/lib/auth";
import { getComplianceEstadoAction } from "../actions";
import ComplianceChecklistPage from "../components/ComplianceChecklistPage";
import type { ComplianceCliente } from "../types";

const SLUG_TO_CLIENTE: Record<string, ComplianceCliente> = {
  "loma-negra": "LOMA_NEGRA",
  ypf: "YPF",
};

export default async function ComplianceClientePage({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  const { cliente: slug } = await params;
  const cliente = SLUG_TO_CLIENTE[slug];
  if (!cliente) notFound();

  const user = await requireArea("compliance", "read");
  const canWrite = hasArea(user, "compliance", "write");

  const { rows, requisitos } = await getComplianceEstadoAction(cliente);

  return (
    <ComplianceChecklistPage
      cliente={cliente}
      rows={rows}
      requisitos={requisitos}
      canWrite={canWrite}
    />
  );
}
