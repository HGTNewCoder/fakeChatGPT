"use client";

import clsx from "clsx";
import { ArrowUp, ImageIcon, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IMAGE_SIZE_OPTIONS } from "@/lib/constants";
import type { ImageSize } from "@/lib/validation";

export type ComposerMode = "text" | "image";

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
};

export function Composer(props: Props) {
  const { onSend, onStop, streaming, disabled, mode, onModeChange } = props;
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const imageMode = mode === "image";

  // Autosize: grow with content; CSS max-height caps it and enables scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Focus on desktop only, so mobile keyboards don't pop open unprompted.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, [mode]);

  const canSend = value.trim().length > 0 && !streaming && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // On touch devices Enter inserts a newline; the send button submits.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    submit();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.focus();
        }}
        className="flex cursor-text flex-col gap-1.5 rounded-[28px] border border-line bg-surface p-2.5 shadow-sm"
      >
        {imageMode && (
          <div className="flex items-center gap-1.5 pt-0.5 pl-1">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-bg pr-1 pl-3 text-sm font-medium">
              <ImageIcon className="size-4" />
              Image
              <button
                type="button"
                onClick={() => onModeChange("text")}
                aria-label="Turn off image mode"
                className="flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            </span>
            <label className="sr-only" htmlFor="image-size">
              Aspect ratio
            </label>
            <select
              id="image-size"
              value={props.imageSize}
              onChange={(e) => props.onImageSizeChange(e.target.value as ImageSize)}
              className="h-8 cursor-pointer rounded-full bg-bg px-3 text-sm text-muted outline-none hover:text-fg"
            >
              {IMAGE_SIZE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => onModeChange(imageMode ? "text" : "image")}
            aria-pressed={imageMode}
            aria-label={imageMode ? "Turn off image mode" : "Create an image"}
            title={imageMode ? "Turn off image mode" : "Create an image"}
            className={clsx(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
              imageMode ? "bg-bg text-fg" : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            <ImageIcon className="size-5" />
          </button>
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={imageMode ? "Describe an image" : "Ask anything"}
            className="max-h-[25dvh] min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base leading-6 outline-none placeholder:text-muted"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-opacity hover:opacity-80"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={imageMode ? "Create image" : "Send message"}
              className={clsx(
                "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-opacity",
                canSend ? "hover:opacity-80" : "opacity-30",
              )}
            >
              <ArrowUp className="size-5" strokeWidth={2.25} />
            </button>
          )}
        </div>
      </form>
      <p className="px-2 py-2.5 text-center text-xs leading-4 text-muted">
        AI replies can be wrong. Chats are not saved.
      </p>
    </div>
  );
}
