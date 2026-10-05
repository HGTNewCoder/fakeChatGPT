"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ getText, label = "Copy", showLabel = false }: {
  getText: () => string;
  label?: string;
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing useful to do
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-hover hover:text-fg"
    >
      <Icon className="size-4" />
      {showLabel && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}
