"use client";

import { motion } from "framer-motion";
import { Truck, BarChart2 } from "lucide-react";

export function LoginDecoration() {
  return (
    <div 
      className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden flex-col items-center justify-end p-12 pb-24 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/fondo-login.jpg')" }}
    >
      {/* Capa de superposición para mejorar la legibilidad de los textos y tarjetas, si fuera necesario */}
      <div className="absolute inset-0 bg-brand-900/40 mix-blend-multiply"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#001f4c] via-[#001f4c]/60 to-transparent h-3/4 mt-auto"></div>

      {/* Vaxler credit */}
      <a
        href="https://www.vaxler.com.ar"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-5 left-6 z-10 opacity-30 hover:opacity-60 transition-opacity duration-300"
      >
        <img
          src="/logo-vaxler.png"
          alt="Vaxler"
          className="h-4 w-auto"
          loading="lazy"
          decoding="async"
        />
      </a>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center text-white mt-auto">
        {/* Textos Principales */}
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mb-2 text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl drop-shadow-lg mt-12"
        >
          Gestión Logística <br />
          <span className="text-accent-500 drop-shadow-md">
            Simplificada
          </span>
        </motion.h2>

        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="mb-8 max-w-md text-base text-white/90 leading-relaxed font-medium"
        >
          Plataforma integral inteligente para el manejo de choferes, viajes y administración diaria.
        </motion.p>
        
        {/* Tarjetas Flotantes */}
        <div className="relative w-full max-w-md h-32 perspective-1000 mb-4">
          {/* Tarjeta 1 */}
          <motion.div 
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1, y: [0, -6, 0] }}
            transition={{ 
              duration: 0.8, delay: 0.6, ease: "easeOut",
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" } 
            }}
            className="absolute left-0 top-0 z-20 flex w-60 items-center gap-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-2xl backdrop-blur-md"
          >
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg">
               <Truck className="h-5 w-5" />
             </div>
             <div className="flex flex-col text-left">
               <span className="text-base font-bold text-white">Operaciones</span>
               <span className="text-xs font-medium text-white/70">Bajo control</span>
             </div>
          </motion.div>

          {/* Tarjeta 2 */}
          <motion.div 
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1, y: [0, 6, 0] }}
            transition={{ 
              duration: 0.8, delay: 0.8, ease: "easeOut",
              y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 } 
            }}
            className="absolute right-0 top-12 z-10 flex w-60 items-center gap-4 rounded-2xl border border-white/10 bg-[#001f4c]/80 px-4 py-3 shadow-2xl backdrop-blur-md"
          >
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-neutral-900 shadow-lg">
               <BarChart2 className="h-5 w-5" />
             </div>
             <div className="flex flex-col text-left">
               <span className="text-base font-bold text-white">Decisiones</span>
               <span className="text-xs font-medium text-white/70">Con información real</span>
             </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
