import { redirect } from "next/navigation";

/** Compliance se unificó en `/compliance`. Redirect para bookmarks viejos. */
export default function ComplianceLomaLegacyRedirect() {
  redirect("/compliance?plat=loma");
}
