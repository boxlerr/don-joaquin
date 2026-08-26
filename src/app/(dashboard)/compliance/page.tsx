import { requireArea, hasArea, hasSeccion } from "@/lib/auth";
import { getComplianceEstadoAplica } from "./actions";
import { getOrganismosAction, getOrganismoChecklistAction } from "./organismos/actions";
import { getForm931Action, getForm931EnvioAction } from "./form-931/actions";
import ComplianceUnifiedClient from "./ComplianceUnifiedClient";
import type { ComplianceClienteAplica } from "./types";

/**
 * Compliance — pantalla única (reunión Nico §9). Una sola solapa "Documentación"
 * con toda la papeleta de YPF + Loma en formato checklist: los documentos generales
 * van a todos y los específicos quedan marcados "(solo YPF)" / "(solo Loma)". Más
 * SICOP, Secondi y el Formulario 931. Cada plataforma se filtra por permiso.
 */
export default async function ComplianceUnifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ plat?: string }>;
}) {
  const user = await requireArea("compliance", "read");
  const canWrite = hasArea(user, "compliance", "write");
  const { plat } = await searchParams;

  // La documentación combina lo general (AMBOS) con lo específico de cada
  // plataforma que el usuario tenga permiso de ver.
  const aplica: ComplianceClienteAplica[] = ["AMBOS"];
  if (hasSeccion(user, "compliance_ypf", "read")) aplica.push("YPF");
  if (hasSeccion(user, "compliance_loma", "read")) aplica.push("LOMA_NEGRA");

  // Organismos previos (SICOP/Secondi y cualquier otro). SICOP/Secondi tienen
  // subsección propia; el resto cae bajo el área compliance (que el usuario ya tiene).
  const organismosActivos = await getOrganismosAction();
  const organismosVisibles = organismosActivos.filter((o) => {
    const c = o.codigo.toLowerCase();
    if (c === "sicop") return hasSeccion(user, "compliance_sicop", "read");
    if (c === "secondi") return hasSeccion(user, "compliance_secondi", "read");
    return true;
  });

  const [documentacion, periodos931, envio931, organismos] = await Promise.all([
    getComplianceEstadoAplica(aplica),
    getForm931Action(),
    getForm931EnvioAction(),
    Promise.all(
      organismosVisibles.map(async (o) => {
        const { destinatario, rows } = await getOrganismoChecklistAction(o.id);
        const c = o.codigo.toLowerCase();
        const canWriteOrg =
          c === "sicop"
            ? hasSeccion(user, "compliance_sicop", "write")
            : c === "secondi"
            ? hasSeccion(user, "compliance_secondi", "write")
            : canWrite;
        return { destinatario: destinatario ?? o, rows, canWrite: canWriteOrg };
      }),
    ),
  ]);

  return (
    <ComplianceUnifiedClient
      canWrite={canWrite}
      // Para el recorrido guiado: la marca de "ya lo vio" es por persona.
      userId={user.id}
      documentacion={documentacion}
      organismos={organismos}
      periodos931={periodos931}
      envio931={envio931}
      initialPlat={plat}
      // Los estados (vencido / por vencer) se calculan contra el día en que se
      // arma la página. La pantalla lo dice y ofrece rehacerla: si alguien cargó
      // un documento hace un minuto, esta copia todavía no lo tiene.
      generadoEn={new Date().toISOString()}
    />
  );
}
