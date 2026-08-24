"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { PlaceCombobox } from "@/components/ui/place-combobox";
import { CATEGORIAS_POR_FLUJO, type CajaFlujo } from "@/lib/caja-tipos";
import { borrarCategoriaLibreAction } from "../actions";

export type CategoriaLibre = { id: string; nombre: string; flujo: string };

/**
 * El campo "Categoría" de la caja: se elige de la lista O SE ESCRIBE.
 *
 * Antes era un desplegable de cinco opciones y para todo lo que no estaba había
 * que elegir "Otro" — o sea que la mitad de la caja terminaba archivada en un
 * cajón que no dice nada. Pedido de Julián (24/08/2026): "que en ingreso puedas
 * escribir lo que quieras, sin tener que poner otro".
 *
 * Es la misma regla que ya rige bancos, libradores y lugares: un catálogo que no
 * va a estar completo se escribe libre, la lista son sugerencias, lo que se
 * escribe se guarda para la próxima y se puede sacar con la X. Las categorías
 * fijas del sistema no llevan X: esas no se borran.
 */
export default function CategoriaCajaField({
  id,
  flujo,
  value,
  onValueChange,
  sugerencias,
}: {
  id: string;
  flujo: CajaFlujo;
  value: string;
  onValueChange: (v: string) => void;
  sugerencias: CategoriaLibre[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Lo borrado desaparece en el acto; el refresh confirma después.
  const [borradas, setBorradas] = useState<string[]>([]);

  const opciones = [
    ...CATEGORIAS_POR_FLUJO[flujo].map((c) => ({
      id: `fija:${c.id}`,
      label: c.label,
      removable: false,
    })),
    ...sugerencias
      .filter((s) => s.flujo === flujo && !borradas.includes(s.id))
      .map((s) => ({ id: s.id, label: s.nombre })),
  ];

  const quitar = (opt: { id: string; label: string }) => {
    setBorradas((prev) => [...prev, opt.id]);
    startTransition(async () => {
      await borrarCategoriaLibreAction(opt.id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        Categoría
      </Label>
      <PlaceCombobox
        inputId={id}
        name={id}
        value={value}
        onValueChange={onValueChange}
        options={opciones}
        onRemoveOption={quitar}
        removeTitle="Sacar de la lista"
        placeholder="Elegí o escribí…"
      />
    </div>
  );
}
