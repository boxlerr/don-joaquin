import { requireArea } from "@/lib/auth";
import { getProximasPresentacionesAction } from "../actions";
import ProximasPresentacionesView from "../components/ProximasPresentacionesView";

export default async function ProximasPresentacionesPage() {
  await requireArea("compliance", "read");
  const rows = await getProximasPresentacionesAction();
  return <ProximasPresentacionesView rows={rows} />;
}
