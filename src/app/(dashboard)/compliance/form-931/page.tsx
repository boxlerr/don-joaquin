import { redirect } from "next/navigation";

/** El F931 ahora es una pestaña de `/compliance`. Redirect para bookmarks viejos. */
export default function Form931LegacyRedirect() {
  redirect("/compliance?plat=931");
}
