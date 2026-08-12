"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUsuarioActualId } from "@/components/layout/UsuarioActualProvider";
import {
  borrarBorrador,
  claveBorrador,
  guardarBorrador,
  leerBorrador,
  type BorradorGuardado,
  type Normalizador,
} from "@/lib/borrador-local";

/** Lo que se espera a que deje de tipear antes de guardar. */
const DEBOUNCE_MS = 400;

export type UseBorrador<T> = {
  /**
   * Un borrador de antes que todavía nadie decidió qué hacer con él. Mientras
   * exista, el autoguardado NO escribe: si no, entrar a la pantalla en blanco
   * pisaría con vacío lo que se quiso salvar.
   */
  pendiente: BorradorGuardado<T> | null;
  /** Cuándo se guardó por última vez lo que se está tipeando ahora. */
  guardadoTs: number | null;
  /** Devuelve lo guardado y saca el aviso. La pantalla decide qué hacer con el valor. */
  recuperar: () => T | null;
  /** Tira el borrador viejo y saca el aviso. */
  descartar: () => void;
  /** Se llama DESPUÉS de que el server confirmó: recién ahí el borrador sobra. */
  limpiar: () => void;
};

/**
 * Guarda en el navegador lo que se está cargando, para que sobreviva a un F5,
 * a cerrar el diálogo sin querer, a que se corte internet y a un corte de luz.
 *
 * Dos reglas que no son obvias y que están acá a propósito:
 *
 * 1. Nunca restaura solo. Encontrar datos en un formulario que abriste en
 *    blanco asusta más de lo que ayuda, y en cargas contra el Excel del cliente
 *    puede terminar en un viaje duplicado. Se ofrece y se decide.
 * 2. Mientras hay un borrador sin decidir, no escribe. El formulario recién
 *    abierto está vacío, y si guardara, borraría lo que vino a rescatar.
 */
export function useBorrador<T>({
  pantalla,
  valor,
  normalizar,
  hayDatos,
  activo = true,
  debounceMs = DEBOUNCE_MS,
}: {
  /** Identifica la pantalla en la clave. Ej: "viajes-carga-rapida". */
  pantalla: string;
  /** El estado actual del formulario o la grilla. */
  valor: T;
  /** Qué hacer con lo que había guardado (completar campos nuevos, descartar). */
  normalizar: Normalizador<T>;
  /** Si esto da `false`, no hay nada que salvar y el borrador se borra. */
  hayDatos: (v: T) => boolean;
  /** `false` mientras el diálogo está cerrado: no se guarda ni se ofrece nada. */
  activo?: boolean;
  debounceMs?: number;
}): UseBorrador<T> {
  const userId = useUsuarioActualId();
  const clave = claveBorrador(pantalla, userId);

  const [pendiente, setPendiente] = useState<BorradorGuardado<T> | null>(null);
  const [guardadoTs, setGuardadoTs] = useState<number | null>(null);

  // En refs para que el efecto de guardado no se reinicie en cada render por
  // una función declarada inline (que es como se va a usar en todas las
  // pantallas). Se sincronizan en un efecto y no durante el render: escribir un
  // ref mientras se renderiza rompe con el modo concurrente de React, y el
  // lint del repo lo corta. Este efecto va PRIMERO para que los de abajo lean
  // siempre el valor de este render.
  const valorRef = useRef(valor);
  const hayDatosRef = useRef(hayDatos);
  const normalizarRef = useRef(normalizar);

  useEffect(() => {
    valorRef.current = valor;
    hayDatosRef.current = hayDatos;
    normalizarRef.current = normalizar;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Se ofrece una vez por ciclo: al abrir. Si ya se decidió, cerrar y volver a
  // abrir no lo vuelve a preguntar. Un guardado exitoso abre un ciclo nuevo.
  const yaOfrecidoRef = useRef(false);

  // La lectura va en efecto y no en el estado inicial: en el servidor no hay
  // `localStorage`, y si el estado inicial difiriera entre servidor y navegador
  // React tiraría error de hidratación.
  useEffect(() => {
    if (!activo || yaOfrecidoRef.current) return;
    yaOfrecidoRef.current = true;
    const previo = leerBorrador<T>(clave, normalizarRef.current);
    if (previo) setPendiente(previo);
  }, [activo, clave]);

  // Autoguardado del formulario entero, no campo por campo: es lo que hace que
  // después de un corte se recupere tal cual estaba.
  useEffect(() => {
    if (!activo || pendiente) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (hayDatosRef.current(valorRef.current)) {
        setGuardadoTs(guardarBorrador(clave, valorRef.current));
      } else {
        borrarBorrador(clave);
        setGuardadoTs(null);
      }
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
  }, [valor, activo, pendiente, clave, debounceMs]);

  // Cerrar la pestaña no espera al debounce. `pagehide` es el único que dispara
  // de forma confiable en celular, donde `beforeunload` a veces no llega.
  useEffect(() => {
    if (!activo || pendiente) return;
    const alSalir = () => {
      if (hayDatosRef.current(valorRef.current)) guardarBorrador(clave, valorRef.current);
    };
    window.addEventListener("pagehide", alSalir);
    return () => window.removeEventListener("pagehide", alSalir);
  }, [activo, pendiente, clave]);

  const recuperar = useCallback(() => {
    const v = pendiente?.valor ?? null;
    setPendiente(null);
    return v;
  }, [pendiente]);

  const descartar = useCallback(() => {
    borrarBorrador(clave);
    setPendiente(null);
    setGuardadoTs(null);
  }, [clave]);

  const limpiar = useCallback(() => {
    // El timer pendiente tiene que morir acá: si no, el debounce que quedó en
    // vuelo vuelve a escribir el borrador que se acaba de guardar en la base.
    clearTimeout(timerRef.current);
    borrarBorrador(clave);
    setPendiente(null);
    setGuardadoTs(null);
    yaOfrecidoRef.current = false;
  }, [clave]);

  return { pendiente, guardadoTs, recuperar, descartar, limpiar };
}
