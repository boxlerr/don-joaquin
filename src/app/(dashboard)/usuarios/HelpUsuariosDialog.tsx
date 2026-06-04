"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  HelpCircle, Users, UserPlus, ShieldCheck, ShieldPlus, Layers, Clock, Info,
} from "lucide-react";
import { AREA_META, NIVEL_INFO } from "./area-meta";

export default function HelpUsuariosDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <HelpCircle size={14} /> ¿Cómo funciona?
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Usuarios y Permisos — guía</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Quién puede entrar al sistema y qué puede hacer en cada sección. Los choferes
              <strong> no</strong> usan el sistema: acá van solo administración, mantenimiento y dirección.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1 text-sm">
            {/* Flujo en 3 pasos */}
            <Section icon={<UserPlus size={15} />} title="Dar acceso a alguien — 3 pasos">
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Crear el usuario</strong> (botón “Nuevo usuario”): nombre, email y una contraseña temporal. En el primer ingreso se la cambia.</li>
                <li><strong className="text-foreground">Asignar un rol</strong> desde el listado: define el acceso base (ver el cuadro de Roles).</li>
                <li><strong className="text-foreground">Afinar con permisos individuales</strong> si necesita una sección extra puntual (abajo de todo).</li>
              </ol>
            </Section>

            {/* Estados */}
            <Section icon={<Users size={15} />} title="Estados del usuario">
              <ul className="space-y-1 text-muted-foreground">
                <li><b className="text-foreground">Activo</b>: puede iniciar sesión.</li>
                <li><b className="text-foreground">Inactivo</b>: existe pero no puede entrar (ej. dado de alta pero todavía sin email real, o de licencia).</li>
                <li><b className="text-foreground">Último acceso</b>: la última vez que entró.</li>
              </ul>
            </Section>

            {/* Roles */}
            <Section icon={<ShieldCheck size={15} />} title="Roles (acceso base)">
              <ul className="space-y-1 text-muted-foreground">
                <li><b className="text-foreground">Administrador</b>: ve y edita todo. (Dirección / sistema.)</li>
                <li><b className="text-foreground">Operativo</b>: base común — Choferes/Siniestros, Camiones/Extintores y Compliance. Las secciones reservadas se habilitan por persona.</li>
                <li><b className="text-foreground">Representante de…</b>: pensado para una sola área (Combustible, Comercial, Finanzas, etc.).</li>
              </ul>
            </Section>

            {/* Niveles */}
            <Section icon={<Layers size={15} />} title="Niveles de permiso">
              <div className="flex flex-wrap gap-2">
                {(["none", "read", "write", "admin"] as const).map((n) => (
                  <span key={n} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${NIVEL_INFO[n].clase}`}>
                    {NIVEL_INFO[n].label}
                    <span className="opacity-70 font-normal">· {NIVEL_INFO[n].desc}</span>
                  </span>
                ))}
              </div>
            </Section>

            {/* La matriz */}
            <Section icon={<ShieldCheck size={15} />} title="La matriz de permisos por área">
              <p className="text-muted-foreground">
                Cada <b className="text-foreground">fila</b> es un rol y cada <b className="text-foreground">columna</b> una sección.
                Elegís el nivel que tiene ese rol en esa sección. El rol <b>Administrador</b> siempre tiene todo y no se edita.
              </p>
            </Section>

            {/* Qué controla cada área */}
            <Section icon={<Info size={15} />} title="Qué controla cada sección (área)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {Object.entries(AREA_META).map(([codigo, meta]) => (
                  <div key={codigo} className="text-xs">
                    <span className="font-semibold text-foreground">{meta.titulo}</span>
                    <span className="text-muted-foreground"> — {meta.paginas.join(", ")}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Overrides */}
            <Section icon={<ShieldPlus size={15} />} title="Permisos individuales (por persona)">
              <p className="text-muted-foreground">
                Sirven para darle a una persona una sección puntual que su rol no incluye. <b className="text-foreground">Solo suman</b> sobre
                el rol (nunca restan). Pueden ser permanentes o con vencimiento — el botón <b className="text-foreground">“Hoy”</b> habilita
                el acceso solo por la jornada (<Clock size={11} className="inline" /> se vence solo).
              </p>
            </Section>

            <div className="rounded-md border border-[#BAE6FD] bg-[#F0F9FF] dark:bg-sky-500/10 dark:border-sky-500/30 text-[#075985] dark:text-sky-300 text-xs px-3 py-2">
              <b>Regla de oro:</b> reservá lo sensible (Caja, Finanzas, Sueldos) y dejá lo operativo abierto. Para dar permisos siempre hay tiempo.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <div className="pl-1">{children}</div>
    </section>
  );
}
