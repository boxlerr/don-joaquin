"use client";

import { useMemo, useState, useTransition } from "react";
import { Shield, Loader2, Lock, Pencil, KeyRound, Trash2, Copy, Check } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { coincideEnAlguno } from "@/lib/texto";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  updateUsuarioRolAction,
  setUsuarioAcceso24Action,
  setUsuarioEstadoAction,
  enviarResetPasswordAction,
  eliminarUsuarioAction,
} from "./actions";
import { rolLabel } from "./area-meta";
import { esAdminPermanente } from "./admins-permanentes";
import EditarUsuarioDialog from "./EditarUsuarioDialog";

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

function nombreCompleto(u: UsuarioRow): string {
  return [u.nombre, u.apellido].filter(Boolean).join(" ") || "—";
}

/** Fila rótulo/control de la tarjeta de celular. */
function CampoMovil({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

/** Rol: combo editable o badge de solo lectura. */
function RolControl({
  usuario,
  roles,
  editable,
  esProtegido,
  saving,
  onChange,
}: {
  usuario: UsuarioRow;
  roles: Rol[];
  editable: boolean;
  esProtegido: boolean;
  saving: boolean;
  onChange: (id: string, rolId: string) => void;
}) {
  if (editable) {
    return (
      <div className="flex items-center gap-2">
        <Combobox
          value={usuario.rol_id ?? ""}
          disabled={saving}
          onValueChange={(v) => onChange(usuario.id, v)}
          options={roles
            .filter((r) => r.codigo !== "admin")
            .map((r) => ({ id: r.id, label: rolLabel(r.nombre) }))}
          searchable={false}
          triggerClassName="h-8 max-md:h-10 w-40"
        />
        {saving && <Loader2 size={14} className="animate-spin text-primary" />}
      </div>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={esProtegido ? "Administrador permanente: su rol no se puede cambiar." : undefined}
    >
      <StatusBadge
        label={usuario.rol_nombre ? rolLabel(usuario.rol_nombre) : "—"}
        tone={usuario.rol_codigo === "admin" ? "warning" : "info"}
      />
      {esProtegido && <Lock size={12} className="text-muted-foreground/60" />}
    </span>
  );
}

/** Excepción al bloqueo por horario laboral ("acceso 24 hs"). */
function Acceso24Control({
  usuario,
  canEdit,
  saving,
  onToggle,
}: {
  usuario: UsuarioRow;
  canEdit: boolean;
  saving: boolean;
  onToggle: (id: string, valor: boolean) => void;
}) {
  if (usuario.rol_codigo === "admin") {
    return (
      <span
        className="text-xs text-muted-foreground/60"
        title="Los administradores entran siempre, a cualquier hora."
      >
        Siempre
      </span>
    );
  }
  if (!canEdit) {
    return (
      <span className="text-xs text-muted-foreground">
        {usuario.acceso_fuera_horario ? "Sí" : "—"}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onToggle(usuario.id, !usuario.acceso_fuera_horario)}
      title={
        usuario.acceso_fuera_horario
          ? "Puede entrar a cualquier hora. Clic para quitar."
          : "Respeta el horario laboral. Clic para permitir 24 hs."
      }
      /* El botón es la zona táctil (36px en celular); la pastilla de adentro es
         lo que se ve. En desktop mide lo mismo que ella. */
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md disabled:opacity-50 sm:size-auto"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          usuario.acceso_fuera_horario ? "bg-primary" : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            usuario.acceso_fuera_horario ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/** Estado: switch para activar/desactivar (bloquea el login). */
function EstadoControl({
  usuario,
  editable,
  saving,
  onToggle,
}: {
  usuario: UsuarioRow;
  editable: boolean;
  saving: boolean;
  onToggle: (id: string, activar: boolean) => void;
}) {
  const activo = usuario.estado === "activo";
  if (!editable) return <StatusBadge label={usuario.estado} tone={activo ? "success" : "neutral"} />;
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onToggle(usuario.id, !activo)}
      title={
        activo
          ? "Activo. Clic para desactivar (le bloquea el acceso)."
          : "Inactivo. Clic para activar."
      }
      className="inline-flex items-center gap-2 disabled:opacity-50 max-md:min-h-9"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          activo ? "bg-emerald-500" : "bg-muted-foreground/25"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
            activo ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className={`text-xs ${activo ? "text-emerald-600" : "text-muted-foreground"}`}>
        {activo ? "Activo" : "Inactivo"}
      </span>
    </button>
  );
}

/** Acciones: editar, reset de contraseña, eliminar. */
function AccionesControl({
  usuario,
  editable,
  esProtegido,
  saving,
  onEdit,
  onReset,
  onDelete,
}: {
  usuario: UsuarioRow;
  editable: boolean;
  esProtegido: boolean;
  saving: boolean;
  onEdit: (u: UsuarioRow) => void;
  onReset: (u: UsuarioRow) => void;
  onDelete: (u: UsuarioRow) => void;
}) {
  if (!editable) {
    return (
      <span
        className="text-xs text-muted-foreground/50"
        title={esProtegido ? "Administrador permanente" : undefined}
      >
        —
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onEdit(usuario)}
        title="Editar nombre / email"
        className="rounded p-1.5 max-md:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => onReset(usuario)}
        title="Generar link para que resetee su contraseña"
        className="rounded p-1.5 max-md:p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
      </button>
      <button
        type="button"
        onClick={() => onDelete(usuario)}
        title="Eliminar usuario"
        className="rounded p-1.5 max-md:p-2.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

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

  const [editUser, setEditUser] = useState<UsuarioRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UsuarioRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ email: string; link: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const filtrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (rolFiltro && u.rol_codigo !== rolFiltro) return false;
      const nombre = `${u.nombre ?? ""} ${u.apellido ?? ""}`;
      return coincideEnAlguno([nombre, u.email], query);
    });
  }, [usuarios, query, rolFiltro]);

  const run = (usuarioId: string, fn: () => Promise<{ ok: true } | { error: string }>) => {
    setSavingId(usuarioId);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setSavingId(null);
      if ("error" in res) setError(res.error);
    });
  };

  const handleRolChange = (id: string, rolId: string) => run(id, () => updateUsuarioRolAction(id, rolId));
  const handleAcceso24 = (id: string, valor: boolean) => run(id, () => setUsuarioAcceso24Action(id, valor));
  const handleEstado = (id: string, activar: boolean) => run(id, () => setUsuarioEstadoAction(id, activar));

  const handleReset = (u: UsuarioRow) => {
    setSavingId(u.id);
    setError(null);
    startTransition(async () => {
      const res = await enviarResetPasswordAction(u.id);
      setSavingId(null);
      if ("error" in res) setError(res.error);
      else setResetInfo({ email: u.email, link: res.link });
    });
  };

  const confirmDelete = () => {
    if (!deleteUser) return;
    setDeleting(true);
    startTransition(async () => {
      const res = await eliminarUsuarioAction(deleteUser.id);
      setDeleting(false);
      if ("error" in res) setError(res.error);
      setDeleteUser(null);
    });
  };

  const copyLink = () => {
    if (!resetInfo?.link) return;
    navigator.clipboard.writeText(resetInfo.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /** Los dueños (admin permanentes) y uno mismo no se editan acá. */
  const permisos = (u: UsuarioRow) => {
    const esProtegido = esAdminPermanente(u.id);
    return { esProtegido, editable: canEdit && u.id !== currentUserId && !esProtegido };
  };

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex flex-col gap-3 px-4 sm:px-5 py-4 border-b border-border lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary shrink-0" />
          <h2 className="text-foreground text-sm font-semibold">Listado de Usuarios</h2>
          <span className="text-xs text-muted-foreground/70">
            {filtrados.length} de {usuarios.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Combobox
            value={rolFiltro}
            onValueChange={setRolFiltro}
            options={[
              { id: "", label: "Todos los roles" },
              ...roles.map((r) => ({ id: r.codigo, label: rolLabel(r.nombre) })),
            ]}
            searchable={false}
            triggerClassName="h-9 max-md:h-10 w-full sm:w-44"
          />
          <Input
            type="search"
            placeholder="Buscar usuario..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="px-4 sm:px-5 py-2.5 bg-red-50 border-b border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Desktop: tabla. La misma fila, en celular, se arma como tarjeta más
          abajo — los controles son los mismos componentes, no se duplica lógica. */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {["Nombre", "Email", "Rol", "Último acceso", "24 hs", "Estado", "Acciones"].map((col) => (
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
                const p = permisos(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {nombreCompleto(u)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <RolControl
                        usuario={u}
                        roles={roles}
                        editable={p.editable}
                        esProtegido={p.esProtegido}
                        saving={savingId === u.id}
                        onChange={handleRolChange}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDate(u.last_login)}
                    </TableCell>
                    {/* Excepción al bloqueo por horario laboral. Los admin entran
                        siempre, así que para ellos no aplica. */}
                    <TableCell>
                      <Acceso24Control
                        usuario={u}
                        canEdit={canEdit}
                        saving={savingId === u.id}
                        onToggle={handleAcceso24}
                      />
                    </TableCell>
                    {/* Estado: switch para activar/desactivar (bloquea el login). */}
                    <TableCell>
                      <EstadoControl
                        usuario={u}
                        editable={p.editable}
                        saving={savingId === u.id}
                        onToggle={handleEstado}
                      />
                    </TableCell>
                    {/* Acciones: editar, reset de contraseña, eliminar. */}
                    <TableCell>
                      <AccionesControl
                        usuario={u}
                        editable={p.editable}
                        esProtegido={p.esProtegido}
                        saving={savingId === u.id}
                        onEdit={setEditUser}
                        onReset={handleReset}
                        onDelete={setDeleteUser}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Celular: una tarjeta por usuario (7 columnas no entran en 375px). */}
      <div className="md:hidden divide-y divide-border">
        {filtrados.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin usuarios</p>
        ) : (
          filtrados.map((u) => {
            const p = permisos(u);
            return (
              <div key={u.id} className="px-4 py-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{nombreCompleto(u)}</p>
                    <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                  </div>
                  <AccionesControl
                    usuario={u}
                    editable={p.editable}
                    esProtegido={p.esProtegido}
                    saving={savingId === u.id}
                    onEdit={setEditUser}
                    onReset={handleReset}
                    onDelete={setDeleteUser}
                  />
                </div>

                <CampoMovil label="Rol">
                  <RolControl
                    usuario={u}
                    roles={roles}
                    editable={p.editable}
                    esProtegido={p.esProtegido}
                    saving={savingId === u.id}
                    onChange={handleRolChange}
                  />
                </CampoMovil>

                <CampoMovil label="Estado">
                  <EstadoControl
                    usuario={u}
                    editable={p.editable}
                    saving={savingId === u.id}
                    onToggle={handleEstado}
                  />
                </CampoMovil>

                <CampoMovil label="Acceso 24 hs">
                  <Acceso24Control
                    usuario={u}
                    canEdit={canEdit}
                    saving={savingId === u.id}
                    onToggle={handleAcceso24}
                  />
                </CampoMovil>

                <CampoMovil label="Último acceso">
                  <span className="text-xs text-muted-foreground">{fmtDate(u.last_login)}</span>
                </CampoMovil>
              </div>
            );
          })
        )}
      </div>

      <EditarUsuarioDialog
        usuario={editUser}
        open={!!editUser}
        onOpenChange={(v) => !v && setEditUser(null)}
        onDone={() => setEditUser(null)}
      />

      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(v) => !v && setDeleteUser(null)}
        title="Eliminar usuario"
        description={
          deleteUser ? (
            <>
              Vas a eliminar el acceso de{" "}
              <span className="font-semibold text-foreground">
                {[deleteUser.nombre, deleteUser.apellido].filter(Boolean).join(" ") || deleteUser.email}
              </span>
              : no va a poder entrar nunca más y sale del listado. Lo que cargó queda en el
              sistema con su nombre. Esta acción no se puede deshacer.
            </>
          ) : undefined
        }
        confirmLabel="Eliminar usuario"
        loading={deleting}
        onConfirm={confirmDelete}
      />

      {/* Link de recuperación de contraseña generado. */}
      <Dialog open={!!resetInfo} onOpenChange={(v) => !v && setResetInfo(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg sm:text-xl">Link de contraseña</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pasale este link a <span className="font-medium text-foreground">{resetInfo?.email}</span> por
              el canal que uses. Al abrirlo, define su propia contraseña. También se intentó enviar por email.
            </DialogDescription>
          </DialogHeader>
          {resetInfo?.link ? (
            <div className="space-y-3 py-1">
              <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs break-all font-mono text-foreground">
                {resetInfo.link}
              </div>
              <Button variant="brand" onClick={copyLink} className="w-full">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Se envió el email de recuperación a {resetInfo?.email}.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
