"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, AlertCircle, Check } from "lucide-react";

interface ExportButtonProps {
  /** Función que se ejecuta al hacer clic. Puede devolver una promesa para manejar el estado de carga automáticamente. */
  onClick: () => Promise<void> | void;
  /** Clases CSS adicionales para personalizar el botón */
  className?: string;
  /** Texto personalizado para el botón (por defecto: 'Exportar a Excel') */
  label?: string;
  /** Deshabilita el botón externamente */
  disabled?: boolean;
}

/**
 * Botón reutilizable para exportación a Excel.
 * Maneja de forma interna los estados de carga (loading), éxito y presentación de errores.
 */
export default function ExportButton({
  onClick,
  className,
  label = "Exportar a Excel",
  disabled = false,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = async () => {
    if (isLoading || disabled) return;

    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      await onClick();
      setSuccess(true);
      // Restaurar el estado de éxito después de unos segundos
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error("Error al exportar a Excel:", err);
      setError(
        err instanceof Error ? err.message : "Ocurrió un error al generar el archivo Excel"
      );
      // Limpiar el mensaje de error automáticamente después de 4 segundos
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className={className}
        disabled={disabled || isLoading}
        onClick={handleClick}
        aria-label={label}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin text-[#10B981]" />
            <span>Exportando...</span>
          </>
        ) : success ? (
          <>
            <Check size={14} className="text-[#10B981]" />
            <span className="text-[#10B981] font-medium">¡Exportado!</span>
          </>
        ) : (
          <>
            <FileSpreadsheet size={14} className="text-[#10B981]" />
            <span>{label}</span>
          </>
        )}
      </Button>

      {error && (
        <span className="text-xs text-[#EF4444] flex items-center gap-1 animate-fade-in bg-[#EF4444]/10 px-2 py-1 rounded-md border border-[#EF4444]/20">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}
