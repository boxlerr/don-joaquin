import { redirect } from "next/navigation";

/** Compliance se unificó en `/compliance`. Redirect para bookmarks viejos. */
export default function ComplianceYpfLegacyRedirect() {
  redirect("/compliance?plat=ypf");
}
