"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/lib/constants";

type Mode = "login" | "register";

const copy = {
  login: {
    title: "Welcome back",
    submit: "Continue",
    switchText: "Don't have an account?",
    switchLink: "Sign up",
    switchHref: "/register",
  },
  register: {
    title: "Create an account",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const text = copy[mode];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-10 text-center text-sm font-semibold tracking-tight">{APP_NAME}</p>
      <h1 className="mb-8 text-center text-[28px] leading-[34px] font-semibold">{text.title}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {mode === "register" && (
          <Field name="name" label="Name" type="text" autoComplete="name" />
        )}
        <Field name="email" label="Email address" type="email" autoComplete="email" />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 8 : undefined}
        />

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-3 h-[52px] rounded-full bg-accent text-base font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Please wait…" : text.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {text.switchText}{" "}
        <Link href={text.switchHref} className="font-medium text-fg underline-offset-2 hover:underline">
          {text.switchLink}
        </Link>
      </p>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="sr-only">{label}</span>
      <input
        {...props}
        required
        placeholder={label}
        className="h-[52px] rounded-full border border-line bg-bg px-5 text-base outline-none transition-colors placeholder:text-muted focus:border-fg"
      />
    </label>
  );
}
