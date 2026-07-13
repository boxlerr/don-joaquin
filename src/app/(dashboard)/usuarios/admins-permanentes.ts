// Administradores permanentes (los dueños): su rol queda fijo en "Administrador"
// y NO se puede cambiar ni bajar — ni desde la UI ni desde la server action —
// los vea quien los vea. En el listado se muestran con una insignia bloqueada
// (candado) en lugar del selector de rol.
//
// Se identifican por id (clave primaria inmutable) a propósito: no depende del
// email, que puede cambiar (el de Nicolás todavía es provisorio "@pendiente").
// El valor es solo el nombre, para que se entienda a quién corresponde cada id.

export const ADMINS_PERMANENTES: Record<string, string> = {
  "df06bc03-d894-4b42-bc80-d32efb1e0844": "Bárbara Joaquín",
  "55f5b9cb-f4ef-4898-9f36-51bed4819192": "Nicolás Joaquín",
  "df84ab95-ff61-4999-8017-c9c63f6111dd": "Julián Boxler",
};

export function esAdminPermanente(usuarioId: string | null | undefined): boolean {
  return !!usuarioId && usuarioId in ADMINS_PERMANENTES;
}

// El rol "Administrador" NO se asigna nunca desde la UI (ni siquiera el dueño):
// solo se otorga a mano en la base de datos. Por eso el rol Administrador no
// aparece en ningún desplegable y las server actions lo rechazan siempre.
