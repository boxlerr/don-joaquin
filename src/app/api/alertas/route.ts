import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("alertas")
    .select("id, tipo, severidad, titulo, mensaje, fecha_disparo, fecha_vencimiento, entidad_tipo, entidad_id")
    .eq("estado", "pendiente")
    .order("fecha_disparo", { ascending: false })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
