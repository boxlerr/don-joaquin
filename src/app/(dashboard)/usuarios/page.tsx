import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Shield, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpenAuditButton } from "@/components/open-audit-button";
import { getCurrentUser, requireArea } from "@/lib/auth";
import RolesPermisosMatrix from "./RolesPermisosMatrix";
import type { AreaCodigo, AreaNivel } from "@/lib/auth";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsuariosPage() {
  await requireArea("sistema", "read");
  const supabase = createAdminClient();
  const currentUser = await getCurrentUser();
  const showMatriz = currentUser?.rol.codigo === "admin";

  const [
    { data: usuarios },
    { count: total },
    { count: admins },
    { count: operativos },
    rolesRes,
    areasRes,
    rolAreasRes,
  ] = await Promise.all([
    supabase
      .from("usuarios")
      .select("*, roles(codigo, nombre)")
      .order("created_at", { ascending: false }),
    supabase.from("usuarios").select("*", { count: "exact", head: true }),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
      .eq("roles.codigo", "admin"),
    supabase
      .from("usuarios")
      .select("*, roles!inner(codigo)", { count: "exact", head: true })
      .eq("roles.codigo", "administrativo"),
    showMatriz
      ? supabase.from("roles").select("id, codigo, nombre").order("codigo")
      : Promise.resolve({ data: null }),
    showMatriz
      ? supabase.from("areas" as never).select("codigo, nombre, orden").order("orden")
      : Promise.resolve({ data: null }),
    showMatriz
      ? supabase.from("rol_areas" as never).select("rol_id, area_codigo, nivel")
      : Promise.resolve({ data: null }),
  ]);

  const roles = (rolesRes.data ?? []) as { id: string; codigo: string; nombre: string }[];
  const areas = (areasRes.data ?? []) as { codigo: AreaCodigo; nombre: string; orden: number }[];
  const rolAreas =
    (rolAreasRes.data ?? []) as { rol_id: string; area_codigo: AreaCodigo; nivel: AreaNivel }[];

  const matrizInicial: Record<string, Partial<Record<AreaCodigo, AreaNivel>>> = {};
  for (const ra of rolAreas) {
    if (!matrizInicial[ra.rol_id]) matrizInicial[ra.rol_id] = {};
    matrizInicial[ra.rol_id][ra.area_codigo] = ra.nivel;
  }

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Usuarios y Permisos"
        description="Acceso administrativo — choferes no acceden al sistema"
        action={
          <div className="flex items-center gap-2">
            <OpenAuditButton />
            <Button variant="brand" size="sm">
              <Plus size={14} />
              Nuevo usuario
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Usuarios totales" value={String(total ?? 0)} color="brand" />
        <StatCard label="Administradores" value={String(admins ?? 0)} sub="Acceso total" color="warning" />
        <StatCard label="Operativos" value={String(operativos ?? 0)} sub="Carga y consulta" color="success" />
      </div>

      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Listado de Usuarios</h2>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-border rounded-md bg-card text-muted-foreground">
              <option>Todos los roles</option>
              <option>Administrador</option>
              <option>Administrativo / Operativo</option>
            </select>
            <Input type="search" placeholder="Buscar usuario..." className="w-56 text-sm" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Nombre", "Email", "Rol", "Último acceso", "Estado"].map((col) => (
                <TableHead
                  key={col}
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!usuarios || usuarios.length === 0 ? (
              <EmptyTableRow message="Sin usuarios registrados" />
            ) : (
              usuarios.map((u) => {
                const rol = (u.roles as unknown as { codigo: string; nombre: string } | null) ?? null;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {[u.nombre, u.apellido].filter(Boolean).join(" ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={rol?.nombre ?? "—"}
                        tone={rol?.codigo === "admin" ? "warning" : "info"}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{fmtDate(u.last_login)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={u.estado}
                        tone={u.estado === "activo" ? "success" : "neutral"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showMatriz && roles.length > 0 && areas.length > 0 && (
        <RolesPermisosMatrix roles={roles} areas={areas} initialMatriz={matrizInicial} />
      )}
    </div>
  );
}
