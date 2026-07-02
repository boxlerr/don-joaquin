"use client";

import { useMemo, useState, useTransition } from "react";
import { Shield, Loader2 } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { updateUsuarioRolAction, setUsuarioAcceso24Action } from "./actions";
import { rolLabel } from "./area-meta";

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
  /** Excepción al bloqueo por horario laboral ("acceso 24 hs"). */
  acceso_fuera_horario: boolean;
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

  const handleAcceso24 = (usuarioId: string, valor: boolean) => {
    setSavingId(usuarioId);
    setError(null);
    startTransition(async () => {
      const res = await setUsuarioAcceso24Action(usuarioId, valor);
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
          <Combobox
            value={rolFiltro}
            onValueChange={setRolFiltro}
            options={[
              { id: "", label: "Todos los roles" },
              ...roles.map((r) => ({ id: r.codigo, label: rolLabel(r.nombre) })),
            ]}
            searchable={false}
            triggerClassName="h-9 w-44"
          />
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
            {["Nombre", "Email", "Rol", "Último acceso", "24 hs", "Estado"].map((col) => (
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
                        <Combobox
                          value={u.rol_id ?? ""}
                          disabled={savingId === u.id}
                          onValueChange={(v) => handleRolChange(u.id, v)}
                          options={roles.map((r) => ({ id: r.id, label: rolLabel(r.nombre) }))}
                          searchable={false}
                          triggerClassName="h-8 w-40"
                        />
                        {savingId === u.id && (
                          <Loader2 size={14} className="animate-spin text-primary" />
                        )}
                      </div>
                    ) : (
                      <StatusBadge
                        label={u.rol_nombre ? rolLabel(u.rol_nombre) : "—"}
                        tone={u.rol_codigo === "admin" ? "warning" : "info"}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {fmtDate(u.last_login)}
                  </TableCell>
                  {/* Excepción al bloqueo por horario laboral. Los admin entran
                      siempre, así que para ellos no aplica. */}
                  <TableCell>
                    {u.rol_codigo === "admin" ? (
                      <span
                        className="text-xs text-muted-foreground/60"
                        title="Los administradores entran siempre, a cualquier hora."
                      >
                        Siempre
                      </span>
                    ) : canEdit ? (
                      <button
                        type="button"
                        disabled={savingId === u.id}
                        onClick={() => handleAcceso24(u.id, !u.acceso_fuera_horario)}
                        title={
                          u.acceso_fuera_horario
                            ? "Puede entrar a cualquier hora aunque el bloqueo por horario esté activo. Clic para quitar."
                            : "Respeta el horario laboral (si el bloqueo está activo). Clic para permitir acceso 24 hs."
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          u.acceso_fuera_horario ? "bg-primary" : "bg-muted-foreground/25"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                            u.acceso_fuera_horario ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {u.acceso_fuera_horario ? "Sí" : "—"}
                      </span>
                    )}
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
