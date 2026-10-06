"use client";

import { useCallback, useEffect, useState } from "react";
import type { GptUpdate } from "@/lib/validation";
import type { GptDto, SharedGptDto } from "@/models/Gpt";

export type Gpt = GptDto;
/** Someone else's GPT opened through its share link. */
export type SharedGpt = SharedGptDto;
/** What chat screens need to show a GPT, whether it's yours or shared with you. */
export type GptCard = Pick<Gpt, "id" | "name" | "description" | "starters" | "avatar" | "capabilities"> & {
  author?: string;
};

export class SessionExpiredError extends Error {}

/** JSON request to the GPT API. Throws with the server's message; 401 → SessionExpiredError. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: typeof init?.body === "string" ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 401) throw new SessionExpiredError("Your session expired. Please log in again.");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

type One = { gpt: Gpt };

/** Calls used by the GPT editor. Each returns the updated GPT. */
export const gptApi = {
  openDraft: () => request<One>("/api/gpts", { method: "POST" }).then((d) => d.gpt),
  get: (id: string) => request<One>(`/api/gpts/${id}`).then((d) => d.gpt),
  update: (id: string, patch: GptUpdate) =>
    request<One>(`/api/gpts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then((d) => d.gpt),
  remove: (id: string) => request<null>(`/api/gpts/${id}`, { method: "DELETE" }),
  addKnowledge: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<One>(`/api/gpts/${id}/knowledge`, { method: "POST", body }).then((d) => d.gpt);
  },
  removeKnowledge: (id: string, fileId: string) =>
    request<One>(`/api/gpts/${id}/knowledge/${fileId}`, { method: "DELETE" }).then((d) => d.gpt),
  /** Opens a share link: adds the GPT to the user's sidebar (unless it's their own). */
  openShared: (shareId: string) =>
    request<{ gpt: SharedGpt; own: boolean }>(`/api/g/${shareId}`, { method: "POST" }),
  hideShared: (shareId: string) => request<null>(`/api/g/${shareId}`, { method: "DELETE" }),
  generateAvatar: (id: string, from: { name: string; description: string }) =>
    request<One>(`/api/gpts/${id}/avatar`, { method: "POST", body: JSON.stringify(from) }).then((d) => d.gpt),
};

type Lists = { gpts: Gpt[]; shared: SharedGpt[] };

/** For the sidebar: the user's created GPTs and the shared GPTs they have opened. */
export function useGpts() {
  const [lists, setLists] = useState<Lists>({ gpts: [], shared: [] });

  const reload = useCallback(async () => {
    try {
      setLists(await request<Lists>("/api/gpts"));
    } catch {
      // Sidebar list is best-effort; the next reload retries.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    request<Lists>("/api/gpts")
      .then((data) => alive && setLists(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return { gpts: lists.gpts, shared: lists.shared, reload };
}
