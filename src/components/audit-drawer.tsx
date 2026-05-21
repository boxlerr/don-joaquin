"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";

type AuditEvent = {
  id: string;
  accion: "login" | "login_fallido" | "logout";
  usuario_id: string | null;
  ip: string;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionBadge(accion: string) {
  switch (accion) {
    case "login":
      return <StatusBadge label="Login exitoso" tone="success" />;
    case "login_fallido":
      return <StatusBadge label="Intento fallido" tone="warning" />;
    case "logout":
      return <StatusBadge label="Logout" tone="info" />;
    default:
      return null;
  }
}

function extractEmail(metadata: Record<string, unknown> | null): string {
  if (!metadata || typeof metadata !== "object") return "—";
  return (metadata.email as string) ?? "—";
}

export function AuditDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("audit_log")
          .select("*")
          .in("accion", ["login", "login_fallido", "logout"])
          .order("created_at", { ascending: false })
          .limit(20);

        if (!cancelled) setEvents((data as AuditEvent[]) ?? []);
      } catch (error) {
        console.error("Error fetching audit events:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-card shadow-2xl z-50 transform transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0088D1] to-[#0077B6] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">Auditoría de Seguridad</h2>
            <p className="text-xs text-blue-100 mt-0.5">Últimos eventos de acceso</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-card/20 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#0088D1] border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">Sin eventos registrados</p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Los eventos aparecen después de un login o logout
              </p>
            </div>
          ) : (
            events.map((event) => {
              const email = extractEmail(event.metadata);
              const razon =
                event.metadata &&
                typeof event.metadata === "object" &&
                (event.metadata as Record<string, unknown>).razon
                  ? String((event.metadata as Record<string, unknown>).razon)
                  : null;

              return (
                <div
                  key={event.id}
                  className="border border-border rounded-lg p-3.5 hover:border-[#CBD5E1] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {email}
                    </p>
                    {getActionBadge(event.accion)}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{fmtDate(event.created_at)}</span>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                      {event.ip}
                    </span>
                  </div>

                  {razon && (
                    <div className="mt-2">
                      <span className="text-xs font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        {razon}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
