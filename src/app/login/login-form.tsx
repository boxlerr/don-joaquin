"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="redirect_to" value={redirectTo ?? "/dashboard"} />

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="admin@donjoaquin.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          Contraseña
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
