import { type LucideIcon } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

interface EmptyStateProps {
  message?: string;
  icon?: LucideIcon;
}

/** Standalone empty state — renders a centered div. Use outside of tables. */
export function EmptyState({
  message = "Sin datos disponibles",
  icon: Icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-5">
      {Icon && (
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#E1F5FE] mb-4">
          <Icon size={24} className="text-primary" />
        </div>
      )}
      <p className="text-muted-foreground/70 text-sm">{message}</p>
    </div>
  );
}

/** Table row empty state — renders a <tr><td>. Use inside <TableBody>. */
export function EmptyTableRow({ message = "Sin datos disponibles" }: { message?: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={99}
        className="py-12 text-center text-muted-foreground/70 text-sm"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}
