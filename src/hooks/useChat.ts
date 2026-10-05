"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { ImageSize, ModelId } from "@/lib/validation";

export type ImageRequest = { prompt: string; size: ImageSize };
export type ImageResult = { url: string; width: number; height: number };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: string;
  /** Set on both halves of an image turn; `result` arrives on the assistant message. */
  image?: { request: ImageRequest; result?: ImageResult };
};

export type Conversation = { id: string; title: string; messages: Message[] };

const uid = () => crypto.randomUUID();

/**
 * Holds conversations in memory only. Nothing is persisted, so a reload starts fresh.
 * One request (text reply or image) runs at a time.
 */
export function useChat(model: ModelId) {
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

  // Shared lifecycle for any in-flight request: abort handle, busy flag, error capture.
  const run = useCallback(
    async (
      convId: string,
      assistantId: string,
      task: (signal: AbortSignal) => Promise<void>,
      onAbort?: (m: Message) => Message,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingId(convId);
      try {
        await task(controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          if (onAbort) patchMessage(convId, assistantId, onAbort);
          return;
        }
        patchMessage(convId, assistantId, (m) => ({
          ...m,
          error: err instanceof Error ? err.message : "Something went wrong",
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreamingId((id) => (id === convId ? null : id));
      }
    },
    [patchMessage],
  );

  const post = useCallback(
    async (url: string, body: unknown, signal: AbortSignal) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 401) {
        router.replace("/login");
        throw new Error("Your session expired. Please log in again.");
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      return res;
    },
    [router],
  );

  const streamText = useCallback(
    (convId: string, history: Message[], assistantId: string) =>
      run(convId, assistantId, async (signal) => {
        const res = await post(
          "/api/chat",
          {
            model,
            // Image turns aren't part of the text conversation the LLM sees.
            messages: history
              .filter((m) => !m.error && !m.image && m.content)
              .map(({ role, content }) => ({ role, content })),
          },
          signal,
        );
        if (!res.body) throw new Error("Empty response");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) patchMessage(convId, assistantId, (m) => ({ ...m, content: m.content + chunk }));
        }
      }),
    [model, patchMessage, post, run],
  );

  const createImage = useCallback(
    (convId: string, assistantId: string, request: ImageRequest) =>
      run(
        convId,
        assistantId,
        async (signal) => {
          const res = await post("/api/image", request, signal);
          const result = (await res.json()) as ImageResult;
          patchMessage(convId, assistantId, (m) => ({ ...m, image: { request, result } }));
        },
        (m) => ({ ...m, error: "Image generation stopped." }),
      ),
    [patchMessage, post, run],
  );

  // Appends a user + empty assistant message, creating the conversation if needed.
  const startTurn = useCallback(
    (content: string, image?: ImageRequest) => {
      const userMsg: Message = { id: uid(), role: "user", content, image: image && { request: image } };
      const assistantMsg: Message = { id: uid(), role: "assistant", content: "", image: image && { request: image } };

      if (!active) {
        const convId = uid();
        const title = content.length > 48 ? `${content.slice(0, 48).trimEnd()}…` : content;
        setConversations((prev) => [{ id: convId, title, messages: [userMsg, assistantMsg] }, ...prev]);
        setActiveId(convId);
        return { convId, history: [userMsg], assistantId: assistantMsg.id };
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === active.id ? { ...c, messages: [...c.messages, userMsg, assistantMsg] } : c,
        ),
      );
      return { convId: active.id, history: [...active.messages, userMsg], assistantId: assistantMsg.id };
    },
    [active],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || streamingId) return;
      const { convId, history, assistantId } = startTurn(content);
      void streamText(convId, history, assistantId);
    },
    [startTurn, streamText, streamingId],
  );

  const generateImage = useCallback(
    (text: string, size: ImageSize) => {
      const prompt = text.trim();
      if (!prompt || streamingId) return;
      const request = { prompt, size };
      const { convId, assistantId } = startTurn(prompt, request);
      void createImage(convId, assistantId, request);
    },
    [createImage, startTurn, streamingId],
  );

  const retry = useCallback(() => {
    if (!active || streamingId) return;
    const last = active.messages.at(-1);
    if (!last || last.role !== "assistant" || !last.error) return;

    const history = active.messages.slice(0, -1);
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: "",
      image: last.image && { request: last.image.request },
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, messages: [...history, assistantMsg] } : c)),
    );
    if (last.image) void createImage(active.id, assistantMsg.id, last.image.request);
    else void streamText(active.id, history, assistantMsg.id);
  }, [active, createImage, streamText, streamingId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    conversations,
    active,
    activeId,
    streamingId,
    send,
    generateImage,
    stop,
    retry,
    select: setActiveId,
    newChat: () => setActiveId(null),
  };
}
