"use client";

import clsx from "clsx";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_NAME, USERNAME_PATTERN } from "@/lib/constants";

type Mode = "login" | "register";

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Log in with your username to continue.",
    submit: "Log in",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/register",
  },
  register: {
    title: "Create your account",
    subtitle: "Just a username and a password. No email needed.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

// Where to go after signing in: a same-site path from ?next= (e.g. a shared GPT link), else home.
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

// Mirrors registerSchema so problems show while typing, before the round trip.
function usernameProblem(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.length < 3) return "At least 3 characters";
  if (v.length > 32) return "At most 32 characters";
  if (!USERNAME_PATTERN.test(v)) return "Letters, numbers, dots or underscores; can't start or end with . or _";
  return null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const register = mode === "register";
  const text = copy[mode];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const userHint = register ? usernameProblem(username) : null;
  const passHint = register && password && password.length < 8 ? "At least 8 characters" : null;
  const confirmHint = register && confirm && confirm !== password ? "Passwords don't match" : null;
  const canSubmit =
    !pending &&
    username.trim() &&
    password &&
    (!register || (!userHint && !passHint && confirm && !confirmHint));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          register ? { username, password, confirmPassword: confirm } : { username, password },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.replace(nextPath());
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-fg">
          {APP_NAME.charAt(0)}
        </span>
        <div>
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-tight">{text.title}</h1>
          <p className="mt-2 text-sm text-muted">{text.subtitle}</p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/40 p-5 shadow-sm sm:p-6"
      >
        <Field
          id="username"
          label="Username"
          icon={<UserRound className="size-[18px]" />}
          value={username}
          onChange={setUsername}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          placeholder={register ? "e.g. alex_nguyen" : "Your username"}
          hint={userHint}
          autoFocus
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={register ? "new-password" : "current-password"}
          placeholder={register ? "At least 8 characters" : "Your password"}
          hint={passHint}
        />
        {register && (
          <PasswordField
            id="confirm"
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            placeholder="Type it again"
            hint={confirmHint}
          />
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 h-12 rounded-full bg-accent text-base font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Please wait…" : text.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {text.switchText}{" "}
        <Link
          href={text.switchHref}
          // Keep ?next= when switching between log in and sign up.
          onClick={(e) => {
            e.preventDefault();
            router.push(text.switchHref + window.location.search);
          }}
          className="font-medium text-fg underline-offset-4 hover:underline"
        >
          {text.switchLink}
        </Link>
      </p>
    </div>
  );
}

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: string | null;
  trailing?: React.ReactNode;
};

function Field({ id, label, icon, value, onChange, hint, trailing, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={clsx(
          "flex h-12 items-center gap-2.5 rounded-xl border bg-bg px-3.5 transition-colors focus-within:border-fg",
          hint ? "border-danger/60" : "border-line",
        )}
      >
        <span className="shrink-0 text-muted">{icon}</span>
        <input
          {...props}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(hint)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        />
        {trailing}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-danger">
          {hint}
        </p>
      )}
    </div>
  );
}

function PasswordField(props: Omit<FieldProps, "icon" | "trailing" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      maxLength={128}
      icon={<LockKeyhole className="size-[18px]" />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  );
}
