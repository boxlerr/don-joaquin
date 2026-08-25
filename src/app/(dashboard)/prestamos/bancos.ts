/**
 * El catálogo de bancos vive en `lib/bancos`: lo usan Préstamos y Cheques, y
 * un logo que estuviera en dos lados terminaría distinto en cada uno.
 *
 * Se re-exporta para que las pantallas de Préstamos sigan importando de acá.
 */
export {
  BANCOS_CONOCIDOS,
  normalizarBanco,
  canonizarBanco,
  listaBancos,
  marcaBanco,
  inicialesBanco,
} from "@/lib/bancos";
export type { MarcaBanco } from "@/lib/bancos";
