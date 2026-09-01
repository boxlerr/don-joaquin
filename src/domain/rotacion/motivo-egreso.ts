/**
 * Por qué se fue una persona, en el vocabulario del legajo.
 *
 * Vive en un archivo propio y no en `choferes/actions.ts` porque ese módulo es
 * `"use server"`: importar un tipo desde ahí arrastra el server a donde no va
 * (ya pasó con los tipos de cheques, `b2a5d12`). `actions.ts` lo re-exporta,
 * así que quien ya lo importaba de ahí no se entera.
 */
export type ChoferMotivoEgreso = "renuncia" | "despido" | "jubilacion" | "otro";
