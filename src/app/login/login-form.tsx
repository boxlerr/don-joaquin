"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="redirect_to" value={redirectTo ?? "/dashboard"} />

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
            placeholder="lucianovaxler@gmail.com"
            className="pr-10 h-11 rounded-lg border-neutral-200 focus:border-[#0088D1] focus:ring-[#0088D1]/20 bg-transparent text-[14px]"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold text-neutral-600">
          Contraseña
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className={`pr-10 h-11 rounded-lg border-neutral-200 focus:border-[#0088D1] focus:ring-[#0088D1]/20 bg-transparent text-[14px] ${!showPassword && "tracking-widest font-bold"}`}
          />
          <button 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 pb-1">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-[#0088D1] focus:ring-[#0088D1]"
            defaultChecked
          />
          <label htmlFor="remember-me" className="ml-2 block text-[13px] font-medium text-neutral-600">
            Recordarme
          </label>
        </div>
        <a href="#" className="text-[13px] font-medium text-[#0088D1] hover:text-[#005a8a] transition-colors">
          ¿Olvidaste tu contraseña?
        </a>
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
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
