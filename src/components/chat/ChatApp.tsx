"use client";

import { useEffect, useState } from "react";
import { useChat } from "@/hooks/useChat";
import type { SessionUser } from "@/lib/auth";
import type { ImageSize, ModelId } from "@/lib/validation";
import { Composer, type ComposerMode } from "./Composer";
import { EmptyState } from "./EmptyState";
import { Sidebar } from "./Sidebar";
import { Thread } from "./Thread";
import { TopBar } from "./TopBar";

const COLLAPSE_KEY = "sidebar-collapsed";

export function ChatApp({ user }: { user: SessionUser }) {
  const [model, setModel] = useState<ModelId>("deepseek-chat");
  const chat = useChat(model);
  // Lives here (not in Composer) so it survives the composer remounting between chats.
  const [mode, setMode] = useState<ComposerMode>("text");
  const [imageSize, setImageSize] = useState<ImageSize>("square_hd");

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the desktop collapse preference after hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const newChat = () => {
    chat.newChat();
    setMobileOpen(false);
  };

  const isEmpty = !chat.active || chat.active.messages.length === 0;
  const isStreaming = chat.streamingId !== null;

  const composer = (
    <Composer
      key={chat.activeId ?? "new"}
      onSend={(text) => (mode === "image" ? chat.generateImage(text, imageSize) : chat.send(text))}
      onStop={chat.stop}
      streaming={isStreaming && chat.streamingId === chat.activeId}
      disabled={isStreaming && chat.streamingId !== chat.activeId}
      mode={mode}
      onModeChange={setMode}
      imageSize={imageSize}
      onImageSizeChange={setImageSize}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-fg">
      <Sidebar
        user={user}
        conversations={chat.conversations}
        activeId={chat.activeId}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onNewChat={newChat}
        onSelect={(id) => {
          chat.select(id);
          setMobileOpen(false);
        }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          model={model}
          onModelChange={setModel}
          onOpenSidebar={() => setMobileOpen(true)}
          onNewChat={newChat}
        />

        {isEmpty ? (
          <EmptyState>{composer}</EmptyState>
        ) : (
          <>
            <Thread
              messages={chat.active!.messages}
              streaming={chat.streamingId === chat.activeId}
              onRetry={chat.retry}
            />
            <div className="pb-[env(safe-area-inset-bottom)]">{composer}</div>
          </>
        )}
      </main>
    </div>
  );
}
