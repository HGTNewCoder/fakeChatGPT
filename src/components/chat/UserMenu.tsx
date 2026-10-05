"use client";

import clsx from "clsx";
import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { applyTheme, readTheme, type ThemePref } from "@/lib/theme";
import { useDismiss } from "./useDismiss";

const THEMES: { id: ThemePref; label: string; icon: React.ReactNode }[] = [
  { id: "system", label: "System", icon: <Monitor className="size-4" /> },
  { id: "light", label: "Light", icon: <Sun className="size-4" /> },
  { id: "dark", label: "Dark", icon: <Moon className="size-4" /> },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ user, collapsed }: { user: SessionUser; collapsed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePref>("system");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTheme(readTheme()), []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-60 rounded-2xl border border-line bg-bg p-1.5 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
          <div className="my-1 h-px bg-line" />
          <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted">Theme</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                applyTheme(t.id);
                setTheme(t.id);
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors hover:bg-hover"
            >
              {t.icon}
              <span className="flex-1 text-left">{t.label}</span>
              {theme === t.id && <Check className="size-4" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={logout}
            className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors hover:bg-hover"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={user.name}
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-hover"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-fg">
          {initials(user.name) || "?"}
        </span>
        <span className={clsx("min-w-0 flex-1", collapsed && "md:hidden")}>
          <span className="block truncate text-sm font-medium">{user.name}</span>
        </span>
      </button>
    </div>
  );
}
