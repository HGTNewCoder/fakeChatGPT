"use client";

import { createContext, useContext, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useGpts } from "@/hooks/useGpts";
import type { SessionUser } from "@/lib/auth";

type ChatContextValue = {
  user: SessionUser;
  chat: ReturnType<typeof useChat>;
  gpts: ReturnType<typeof useGpts>;
  /** GPT picked for the next new chat; existing chats remember their own. */
  pendingGptId: string | undefined;
  setPendingGptId: (id: string | undefined) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Lives in the (chat) layout, which stays mounted across its pages, so in-memory chats survive
 * a trip to the GPT editor and back.
 */
export function ChatProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const chat = useChat();
  const gpts = useGpts();
  const [pendingGptId, setPendingGptId] = useState<string>();

  return (
    <ChatContext.Provider value={{ user, chat, gpts, pendingGptId, setPendingGptId }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChatContext must be used inside ChatProvider");
  return value;
}
