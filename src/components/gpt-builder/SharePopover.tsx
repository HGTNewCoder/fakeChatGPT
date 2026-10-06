"use client";

import clsx from "clsx";
import { Check, Copy, Link2, Lock, Share } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "@/components/chat/useDismiss";
import type { Gpt } from "@/hooks/useGpts";

type Props = {
  gpt: Gpt;
  onChange: (visibility: Gpt["visibility"]) => Promise<void>;
};

const OPTIONS = [
  { id: "private", label: "Only me", hint: "Nobody else can use it", icon: <Lock className="size-4" /> },
  {
    id: "link",
    label: "Anyone with the link",
    hint: "Signed-in users with the link can chat with it, but can't see its instructions or files",
    icon: <Link2 className="size-4" />,
  },
] as const;

/** Like the sharing menu in ChatGPT's GPT editor. Changes apply immediately. */
export function SharePopover({ gpt, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const draft = gpt.status !== "published";
  const url = gpt.shareId ? `${window.location.origin}/g/${gpt.shareId}` : "";

  async function choose(visibility: Gpt["visibility"]) {
    if (visibility === gpt.visibility || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onChange(visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change sharing");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the link is still selectable in the field
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm transition-colors hover:bg-hover"
      >
        <Share className="size-4" />
        <span className="hidden sm:inline">Share</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share GPT"
          className="absolute top-full right-0 z-30 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-bg p-2 shadow-lg"
        >
          {draft ? (
            <p className="px-2 py-3 text-sm text-muted">Press Create first. Drafts can&apos;t be shared.</p>
          ) : (
            <>
              <div role="radiogroup" className="flex flex-col gap-1">
                {OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={gpt.visibility === o.id}
                    disabled={busy}
                    onClick={() => choose(o.id)}
                    className={clsx(
                      "flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-60",
                      gpt.visibility === o.id && "bg-hover",
                    )}
                  >
                    <span className="mt-0.5 text-muted">{o.icon}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{o.label}</span>
                      <span className="block text-xs leading-4 text-muted">{o.hint}</span>
                    </span>
                    {gpt.visibility === o.id && <Check className="mt-0.5 size-4" />}
                  </button>
                ))}
              </div>

              {gpt.visibility === "link" && url && (
                <div className="mt-2 flex items-center gap-1 rounded-xl border border-line p-1 pl-3">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    aria-label="Share link"
                    className="min-w-0 flex-1 bg-transparent text-xs text-muted outline-none"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-accent-fg hover:opacity-85"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              )}
              {gpt.visibility === "link" && (
                <p className="px-2 pt-2 text-xs leading-4 text-muted">
                  Their chats use your DeepSeek and fal.ai credit.
                </p>
              )}
            </>
          )}
          {error && <p className="px-2 pt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
