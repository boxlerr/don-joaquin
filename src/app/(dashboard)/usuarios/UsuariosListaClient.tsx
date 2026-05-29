"use client";

import { useMemo, useState, useTransition } from "react";
import { Shield, Loader2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { updateUsuarioRolAction } from "./actions";

export type UsuarioRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
  rol_id: string | null;
  rol_codigo: string | null;
  rol_nombre: string | null;
  estado: string;
  last_login: string | null;
};

type Rol = { id: string; codigo: string; nombre: string };

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

export default function UsuariosListaClient({
  usuarios,
  roles,
  currentUserId,
  canEdit,
}: {
  usuarios: UsuarioRow[];
  roles: Rol[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [rolFiltro, setRolFiltro] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (rolFiltro && u.rol_codigo !== rolFiltro) return false;
      if (q) {
        const nombre = `${u.nombre ?? ""} ${u.apellido ?? ""}`.toLowerCase();
        if (!nombre.includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [usuarios, query, rolFiltro]);

  const handleRolChange = (usuarioId: string, rolId: string) => {
    setSavingId(usuarioId);
    setError(null);
    startTransition(async () => {
      const res = await updateUsuarioRolAction(usuarioId, rolId);
      setSavingId(null);
      if ("error" in res) setError(res.error);
    });
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <h2 className="text-foreground text-sm font-semibold">Listado de Usuarios</h2>
          <span className="text-xs text-muted-foreground/70">
            {filtrados.length} de {usuarios.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-md bg-card text-muted-foreground"
          >
            <option value="">Todos los roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.codigo}>
                {r.nombre}
              </option>
            ))}
          </select>
          <Input
            type="search"
            placeholder="Buscar usuario..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

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
          {filtrados.length === 0 ? (
            <EmptyTableRow message="Sin usuarios" />
          ) : (
            filtrados.map((u) => {
              const esMismo = u.id === currentUserId;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {[u.nombre, u.apellido].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {canEdit && !esMismo ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={u.rol_id ?? ""}
                          disabled={savingId === u.id}
                          onChange={(e) => handleRolChange(u.id, e.target.value)}
                          className="h-8 px-2 text-sm border border-border rounded-md bg-card text-foreground focus:ring-2 focus:ring-[#0088D1]/20 focus:border-[#0088D1] outline-none disabled:opacity-50 cursor-pointer"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>
                        {savingId === u.id && (
                          <Loader2 size={14} className="animate-spin text-primary" />
                        )}
                      </div>
                    ) : (
                      <StatusBadge
                        label={u.rol_nombre ?? "—"}
                        tone={u.rol_codigo === "admin" ? "warning" : "info"}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {fmtDate(u.last_login)}
                  </TableCell>
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
  );
}
