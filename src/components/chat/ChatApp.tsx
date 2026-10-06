"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { gptApi, type GptCard } from "@/hooks/useGpts";
import type { ImageSize } from "@/lib/validation";
import { useChatContext } from "./ChatProvider";
import { Composer, type ComposerMode } from "./Composer";
import { EmptyState } from "./EmptyState";
import { Sidebar } from "./Sidebar";
import { Thread } from "./Thread";
import { TopBar } from "./TopBar";

const COLLAPSE_KEY = "sidebar-collapsed";

export function ChatApp() {
  const router = useRouter();
  const { user, chat, gpts, pendingGptId, setPendingGptId } = useChatContext();
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

  const newChat = (gptId?: string) => {
    chat.newChat();
    setPendingGptId(gptId);
    if (gptId) setMode("text");
    setMobileOpen(false);
  };

  const currentGptId = chat.active ? chat.active.gptId : pendingGptId;
  const ownGpt = gpts.gpts.find((g) => g.id === currentGptId);
  const sharedGpt = ownGpt ? undefined : gpts.shared.find((g) => g.id === currentGptId);
  const currentGpt: GptCard | undefined = ownGpt ?? sharedGpt;
  // Someone else's GPT is only reachable through its share link.
  const gptRef = { gptId: currentGptId, shareId: chat.active ? chat.active.shareId : sharedGpt?.shareId };
  const allowImages = currentGpt?.capabilities.imageGeneration ?? true;

  const isEmpty = !chat.active || chat.active.messages.length === 0;
  const isStreaming = chat.streamingId !== null;

  const composer = (
    <Composer
      key={chat.activeId ?? `new-${pendingGptId ?? ""}`}
      onSend={(text, attachments) =>
        chat.send(text, attachments, {
          ...gptRef,
          imageSize: mode === "image" && allowImages ? imageSize : undefined,
        })
      }
      onStop={chat.stop}
      streaming={isStreaming && chat.streamingId === chat.activeId}
      disabled={isStreaming && chat.streamingId !== chat.activeId}
      mode={allowImages ? mode : "text"}
      onModeChange={setMode}
      allowImages={allowImages}
      imageSize={imageSize}
      onImageSizeChange={setImageSize}
      placeholder={currentGpt ? `Message ${currentGpt.name}` : undefined}
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
        onNewChat={() => newChat()}
        onSelect={(id) => {
          chat.select(id);
          setMobileOpen(false);
        }}
        onDelete={chat.remove}
        gpts={gpts.gpts}
        shared={gpts.shared}
        onHideShared={async (g) => {
          await gptApi.hideShared(g.shareId).catch(() => {});
          if (pendingGptId === g.id) setPendingGptId(undefined);
          await gpts.reload();
        }}
        currentGptId={currentGpt?.id}
        onStartGpt={(id) => newChat(id)}
        onEditGpt={(gpt) => router.push(`/gpts/editor/${gpt.id}`)}
        onCreateGpt={() => router.push("/gpts/new")}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar gpt={currentGpt} onOpenSidebar={() => setMobileOpen(true)} onNewChat={() => newChat()} />

        {isEmpty ? (
          <EmptyState gpt={currentGpt} onStarter={(text) => chat.send(text, [], gptRef)}>
            {composer}
          </EmptyState>
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
