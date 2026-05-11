"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    null,
  );

  if (state?.success) {
    return (
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-[#0088D1]" />
        </div>
        <p className="text-sm text-neutral-600 leading-relaxed">
          Si el email está registrado, recibirás un link para restablecer tu contraseña en los próximos minutos.
        </p>
        <Link
          href="/login"
          className="block text-[13px] font-medium text-[#0088D1] hover:text-[#005a8a] transition-colors"
        >
          ← Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold text-neutral-600">
          Email
        </label>
        <div className="relative">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder="nombre@empresa.com"
            className="pr-10 h-11 rounded-lg border-neutral-200 focus:border-[#0088D1] focus:ring-[#0088D1]/20 bg-transparent text-[14px]"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full h-11 bg-[#0088D1] hover:bg-[#0077B6] text-white text-[15px] font-semibold rounded-lg shadow-sm transition-all"
      >
        {pending ? "Enviando…" : "Enviar link de recuperación"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-[13px] font-medium text-[#0088D1] hover:text-[#005a8a] transition-colors"
      >
        ← Volver al inicio de sesión
      </Link>
    </form>
  );
}
