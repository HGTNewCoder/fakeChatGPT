"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_IMAGES_PER_MESSAGE, type GptDraft, type ImageSize } from "@/lib/validation";

/** A ready-to-send attachment: images carry a data URL, documents their extracted text. */
export type Attachment = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "file";
  dataUrl?: string;
  text?: string;
  truncated?: boolean;
};

/** An image the assistant is creating (no url yet) or has created. */
export type GeneratedImage = {
  prompt: string;
  size: ImageSize;
  edit?: boolean;
  url?: string;
  width?: number;
  height?: number;
};

export type Source = { title: string; url: string };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  attachments?: Attachment[];
  /** User turns sent from image mode: the reply is always an image of this size. */
  imageSize?: ImageSize;
  image?: GeneratedImage;
  /** Web searches the assistant ran for this reply, in order. */
  searches?: string[];
  sources?: Source[];
  /** True between a search and the next text: drives the "Searching the web" indicator. */
  searching?: boolean;
};

/** `shareId` is set when the GPT belongs to someone else and is used through its share link. */
export type Conversation = { id: string; title: string; messages: Message[]; gptId?: string; shareId?: string };

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "search"; query: string }
  | { type: "sources"; sources: Source[] }
  | { type: "image_start"; prompt: string; size: ImageSize; edit: boolean }
  | ({ type: "image"; prompt: string; size: ImageSize } & Required<Pick<GeneratedImage, "url" | "width" | "height">>)
  | { type: "error"; message: string };

const uid = () => crypto.randomUUID();

/**
 * Builds the request history. Documents are inlined as text; image attachments go alongside as
 * data URLs, but only the newest few are re-sent to keep request bodies small.
 */
function toApiMessages(history: Message[]) {
  let imageBudget = MAX_IMAGES_PER_MESSAGE;
  return history
    .filter((m) => !m.error && (m.content || m.attachments?.length || m.image?.url))
    .reverse()
    .map(({ role, content, attachments = [], image }) => {
      const files = attachments
        .filter((a) => a.kind === "file")
        .map((a) => `<file name="${a.name}">\n${a.text ?? ""}\n</file>`);
      const images = attachments
        .filter((a) => a.kind === "image" && a.dataUrl)
        .map((a) => a.dataUrl!)
        .slice(0, Math.max(0, imageBudget));
      imageBudget -= images.length;
      return {
        role,
        content: [...files, content].filter(Boolean).join("\n\n"),
        ...(images.length ? { images } : {}),
        ...(image?.url ? { generated: { prompt: image.prompt, url: image.url } } : {}),
      };
    })
    .reverse();
}

/**
 * Holds conversations in memory only. Nothing is persisted, so a reload starts fresh.
 * One request runs at a time.
 */
export function useChat(options: { getDraft?: () => GptDraft } = {}) {
  // Read at request time, so the editor's Preview always chats with the latest unsaved settings.
  const draftRef = useRef(options.getDraft);
  useEffect(() => {
    draftRef.current = options.getDraft;
  });
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const patchMessage = useCallback(
    (convId: string, msgId: string, fn: (m: Message) => Message) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) }
            : c,
        ),
      );
    },
    [],
  );

  // Streams one assistant reply: text deltas, and possibly an image the model decided to create.
  const stream = useCallback(
    async (convId: string, history: Message[], assistantId: string, gptId?: string, shareId?: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingId(convId);
      const patch = (fn: (m: Message) => Message) => patchMessage(convId, assistantId, fn);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gptId,
            shareId,
            gptDraft: draftRef.current?.(),
            imageSize: history.at(-1)?.imageSize,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            messages: toApiMessages(history),
          }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          router.replace("/login");
          throw new Error("Your session expired. Please log in again.");
        }
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line) as StreamEvent;
            if (event.type === "text") patch((m) => ({ ...m, content: m.content + event.text, searching: false }));
            else if (event.type === "search")
              patch((m) => ({ ...m, searches: [...(m.searches ?? []), event.query], searching: true }));
            else if (event.type === "sources")
              patch((m) => {
                const known = new Set(m.sources?.map((s) => s.url));
                const fresh = event.sources.filter((s) => !known.has(s.url) && known.add(s.url));
                return { ...m, sources: [...(m.sources ?? []), ...fresh] };
              });
            else if (event.type === "image_start")
              patch((m) => ({ ...m, image: { prompt: event.prompt, size: event.size, edit: event.edit } }));
            else if (event.type === "image")
              patch((m) => ({
                ...m,
                image: {
                  ...m.image,
                  prompt: event.prompt,
                  size: event.size,
                  url: event.url,
                  width: event.width,
                  height: event.height,
                },
              }));
            else throw new Error(event.message);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          patch((m) => ({
            ...m,
            searching: false,
            ...(m.image && !m.image.url ? { error: "Image generation stopped." } : {}),
          }));
          return;
        }
        patch((m) => ({ ...m, searching: false, error: err instanceof Error ? err.message : "Something went wrong" }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreamingId((id) => (id === convId ? null : id));
      }
    },
    [patchMessage, router],
  );

  /**
   * Appends a user + empty assistant message, creating the conversation if needed.
   * `gptId` only applies when this message starts a new conversation; `imageSize` forces an image.
   */
  const send = useCallback(
    (
      text: string,
      attachments: Attachment[] = [],
      opts: { gptId?: string; shareId?: string; imageSize?: ImageSize } = {},
    ) => {
      const content = text.trim();
      if ((!content && !attachments.length) || streamingId) return;

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content,
        attachments: attachments.length ? attachments : undefined,
        imageSize: opts.imageSize,
      };
      const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };

      if (!active) {
        const convId = uid();
        const label = content || attachments[0]?.name || "New chat";
        const title = label.length > 48 ? `${label.slice(0, 48).trimEnd()}…` : label;
        setConversations((prev) => [
          { id: convId, title, gptId: opts.gptId, shareId: opts.shareId, messages: [userMsg, assistantMsg] },
          ...prev,
        ]);
        setActiveId(convId);
        void stream(convId, [userMsg], assistantMsg.id, opts.gptId, opts.shareId);
        return;
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, userMsg, assistantMsg] } : c)),
      );
      void stream(active.id, [...active.messages, userMsg], assistantMsg.id, active.gptId, active.shareId);
    },
    [active, stream, streamingId],
  );

  const retry = useCallback(() => {
    if (!active || streamingId) return;
    const last = active.messages.at(-1);
    if (!last || last.role !== "assistant" || !last.error) return;

    const history = active.messages.slice(0, -1);
    const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, messages: [...history, assistantMsg] } : c)),
    );
    void stream(active.id, history, assistantMsg.id, active.gptId, active.shareId);
  }, [active, stream, streamingId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const remove = useCallback(
    (id: string) => {
      // Stop a reply still streaming into this chat before dropping it.
      if (streamingId === id) abortRef.current?.abort();
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((current) => (current === id ? null : current));
    },
    [streamingId],
  );

  return {
    conversations,
    active,
    activeId,
    streamingId,
    send,
    stop,
    retry,
    remove,
    select: setActiveId,
    newChat: () => setActiveId(null),
  };
}
