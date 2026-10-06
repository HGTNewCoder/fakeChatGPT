"use client";

import clsx from "clsx";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/Markdown";
import type { BuilderPatch, EditorConfig } from "./types";

type Turn = { id: string; role: "user" | "assistant"; content: string; error?: string };

const GREETING =
  "Hi! I'll help you build a new GPT. You can say something like, \"make a tutor who explains physics with " +
  "everyday examples\" or \"make an assistant that turns my notes into polished emails.\"\n\nWhat would you like to make?";

type Props = {
  config: EditorConfig;
  onPatch: (patch: BuilderPatch) => void;
};

/** The Create tab: a conversation with the GPT Builder, which fills in the configuration as you talk. */
export function BuilderChat({ config, onPatch }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const patchLast = (fn: (t: Turn) => Turn) => setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? fn(t) : t)));

  async function send() {
    const content = value.trim();
    if (!content || busy) return;
    const history = [...turns.filter((t) => !t.error && t.content), { id: crypto.randomUUID(), role: "user" as const, content }];
    setTurns([...history, { id: crypto.randomUUID(), role: "assistant", content: "" }]);
    setValue("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/gpts/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            name: config.name,
            description: config.description,
            instructions: config.instructions,
            starters: config.starters,
            capabilities: config.capabilities,
          },
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "text") patchLast((t) => ({ ...t, content: t.content + event.text }));
          else if (event.type === "config") onPatch(event.patch as BuilderPatch);
          else if (event.type === "error") throw new Error(event.message);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        patchLast((t) => ({ ...t, error: err instanceof Error ? err.message : "Something went wrong" }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
          <BuilderMessage role="assistant" content={GREETING} />
          {turns.map((t, i) => (
            <BuilderMessage
              key={t.id}
              role={t.role}
              content={t.content}
              error={t.error}
              pending={busy && i === turns.length - 1 && !t.content}
            />
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mx-auto mb-4 flex w-[calc(100%-32px)] max-w-2xl items-end gap-1 rounded-[26px] border border-line bg-surface p-2"
      >
        <label htmlFor="builder-input" className="sr-only">
          Message GPT Builder
        </label>
        <textarea
          id="builder-input"
          ref={input}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message GPT Builder"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-3 py-1.5 text-base leading-6 outline-none placeholder:text-muted"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            aria-label="Stop"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-80"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            <ArrowUp className="size-5" strokeWidth={2.25} />
          </button>
        )}
      </form>
    </div>
  );
}

function BuilderMessage({
  role,
  content,
  error,
  pending,
}: {
  role: "user" | "assistant";
  content: string;
  error?: string;
  pending?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-3xl bg-surface px-5 py-2.5 leading-7 break-words whitespace-pre-wrap">
          {content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold">
        GB
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-sm font-semibold">GPT Builder</p>
        {pending ? (
          <span className="caret h-7" aria-label="Thinking" />
        ) : (
          content && (
            <div className={clsx("markdown text-[15px]")}>
              <Markdown content={content} />
            </div>
          )
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
