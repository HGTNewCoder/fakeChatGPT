"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Composer, type ComposerMode } from "@/components/chat/Composer";
import { GptAvatar } from "@/components/chat/GptAvatar";
import { IconButton } from "@/components/chat/IconButton";
import { Thread } from "@/components/chat/Thread";
import { useChat } from "@/hooks/useChat";
import type { ImageSize } from "@/lib/validation";
import type { EditorConfig } from "./types";

/**
 * Live test chat on the right of the editor. It talks to the saved GPT (for knowledge files) but with
 * the editor's current, possibly unsaved, name, instructions and capabilities.
 */
export function Preview({ gptId, config }: { gptId: string; config: EditorConfig }) {
  const chat = useChat({
    getDraft: () => ({
      name: config.name,
      description: config.description,
      instructions: config.instructions,
      capabilities: config.capabilities,
    }),
  });
  const [mode, setMode] = useState<ComposerMode>("text");
  const [imageSize, setImageSize] = useState<ImageSize>("square_hd");
  const allowImages = config.capabilities.imageGeneration;
  const messages = chat.active?.messages ?? [];
  const streaming = chat.streamingId !== null;

  const send = (text: string, attachments: Parameters<typeof chat.send>[1] = []) =>
    chat.send(text, attachments, {
      gptId,
      imageSize: mode === "image" && allowImages ? imageSize : undefined,
    });

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex h-12 shrink-0 items-center justify-center border-b border-line px-3">
        <h2 className="text-sm font-semibold">Preview</h2>
        {messages.length > 0 && (
          <IconButton label="Restart preview" onClick={chat.newChat} className="absolute right-2 md:right-3">
            <RotateCcw className="size-4" />
          </IconButton>
        )}
      </header>

      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6">
          <GptAvatar name={config.name || "?"} avatar={config.avatar} className="size-16 text-2xl" />
          <p className="text-center text-xl font-semibold">{config.name || "Untitled GPT"}</p>
          {config.description && <p className="max-w-sm text-center text-sm text-muted">{config.description}</p>}
          {config.starters.length > 0 && (
            <ul className="mt-4 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {config.starters.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="line-clamp-2 h-full w-full rounded-2xl border border-line px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-fg"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Thread messages={messages} streaming={streaming} onRetry={chat.retry} />
      )}

      <div className="pb-[env(safe-area-inset-bottom)]">
        <Composer
          key={chat.activeId ?? "new"}
          onSend={send}
          onStop={chat.stop}
          streaming={streaming}
          mode={allowImages ? mode : "text"}
          onModeChange={setMode}
          allowImages={allowImages}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          placeholder={`Message ${config.name || "your GPT"}`}
        />
      </div>
    </div>
  );
}
