"use client";

import clsx from "clsx";
import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Conversation } from "@/hooks/useChat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ConversationList({ conversations, activeId, onSelect, onDelete }: Props) {
  // Chats aren't saved anywhere, so deleting asks for an inline confirmation first.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section className="pt-5 pb-2">
      <h2 className="px-2.5 pb-2 text-xs font-medium text-muted">Chats</h2>
      {conversations.length === 0 ? (
        <p className="px-2.5 text-xs leading-4 text-muted">
          Chats are kept only until you leave or reload this page.
        </p>
      ) : (
        <ul className="flex flex-col gap-px">
          {conversations.map((c) =>
            c.id === confirmId ? (
              <li
                key={c.id}
                className="flex h-9 items-center gap-1 rounded-lg bg-hover pr-1 pl-2.5"
                onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-danger">Delete “{c.title}”?</span>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    onDelete(c.id);
                    setConfirmId(null);
                  }}
                  aria-label="Confirm delete"
                  title="Delete"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  aria-label="Cancel delete"
                  title="Cancel"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </li>
            ) : (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === activeId ? "page" : undefined}
                  className={clsx(
                    "block h-9 w-full truncate rounded-lg pr-9 pl-2.5 text-left text-sm transition-colors hover:bg-hover",
                    c.id === activeId && "bg-hover font-medium",
                  )}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(c.id)}
                  aria-label={`Delete ${c.title}`}
                  title="Delete chat"
                  className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 pointer-coarse:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
