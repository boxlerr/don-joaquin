/**
 * Formatea un CUIT/CUIL al patrón XX-XXXXXXXX-X.
 * Limita a 11 dígitos e ignora cualquier carácter no numérico.
 */
export function formatCuit(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
