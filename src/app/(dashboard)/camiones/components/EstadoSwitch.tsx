"use client";

// Switch de estado de la unidad (mismo patrón que el catálogo de insumos de
// Mantenimiento): prendido = activa, apagado = inactiva. Si la unidad está en
// mantenimiento o de baja se ve apagado y prenderlo la reactiva.
export default function EstadoSwitch({
  activo,
  pending,
  onToggle,
  title,
}: {
  activo: boolean;
  pending?: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={pending}
      onClick={(e) => {
        // La fila abre el detalle al click: el switch no debe propagar.
        e.stopPropagation();
        onToggle();
      }}
      title={title ?? (activo ? "Desactivar unidad" : "Activar unidad")}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0088D1]/40 ${
        activo ? "bg-[#10B981]" : "bg-muted-foreground/30"
      } ${pending ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          activo ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
