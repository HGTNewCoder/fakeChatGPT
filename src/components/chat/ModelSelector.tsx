"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MODEL_OPTIONS } from "@/lib/constants";
import type { ModelId } from "@/lib/validation";
import { useDismiss } from "./useDismiss";

export function ModelSelector({ value, onChange }: { value: ModelId; onChange: (m: ModelId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const current = MODEL_OPTIONS.find((m) => m.id === value) ?? MODEL_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-lg font-medium transition-colors hover:bg-hover"
      >
        {current.label}
        <ChevronDown className="size-4 text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 w-72 rounded-2xl border border-line bg-bg p-1.5 shadow-lg"
        >
          {MODEL_OPTIONS.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={m.id === value}
                onClick={() => {
                  onChange(m.id);
                  close();
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-hover",
                )}
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted">{m.description}</span>
                </span>
                {m.id === value && <Check className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
