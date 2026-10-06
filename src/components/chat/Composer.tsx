"use client";

import clsx from "clsx";
import { ArrowUp, ImageIcon, Paperclip, Plus, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "@/hooks/useChat";
import { IMAGE_SIZE_OPTIONS } from "@/lib/constants";
import {
  ACCEPT,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  fileKind,
  imageToDataUrl,
} from "@/lib/files";
import type { ImageSize } from "@/lib/validation";
import { AttachmentChip } from "./AttachmentChip";
import { useDismiss } from "./useDismiss";

export type ComposerMode = "text" | "image";

export type PendingAttachment = Attachment & { status: "loading" | "ready" | "error"; error?: string };

type Props = {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  /** False when the current GPT has image generation turned off. */
  allowImages?: boolean;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  placeholder?: string;
};

export function Composer(props: Props) {
  const { onSend, onStop, streaming, disabled, mode, onModeChange } = props;
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, menuOpen, closeMenu);
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

  const patch = (id: string, next: Partial<PendingAttachment>) =>
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)));

  async function load(item: PendingAttachment, file: File) {
    try {
      if (item.kind === "image") {
        patch(item.id, { status: "ready", dataUrl: await imageToDataUrl(file) });
        return;
      }
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't read this file");
      patch(item.id, { status: "ready", text: data.text, truncated: data.truncated });
    } catch (err) {
      patch(item.id, { status: "error", error: err instanceof Error ? err.message : "Couldn't read this file" });
    }
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files];
    let images = attachments.filter((a) => a.kind === "image").length;
    let count = attachments.length;
    const skipped: string[] = [];

    for (const file of list) {
      const kind = fileKind(file.name, file.type);
      if (kind === "unsupported") skipped.push(`${file.name} isn't a supported file type`);
      else if (file.size > MAX_FILE_BYTES) skipped.push(`${file.name} is larger than 4 MB`);
      else if (count >= MAX_ATTACHMENTS) skipped.push(`You can attach up to ${MAX_ATTACHMENTS} files`);
      else if (kind === "image" && images >= MAX_IMAGES_PER_MESSAGE)
        skipped.push(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images`);
      else {
        const item: PendingAttachment = {
          id: crypto.randomUUID(),
          name: file.name || "pasted-image.png",
          size: file.size,
          kind: kind === "image" ? "image" : "file",
          status: "loading",
        };
        count++;
        if (kind === "image") images++;
        setAttachments((prev) => [...prev, item]);
        void load(item, file);
      }
    }
    setNotice(skipped.length ? [...new Set(skipped)].join(". ") : null);
  }

  const loading = attachments.some((a) => a.status === "loading");
  const ready = attachments.filter((a) => a.status === "ready");
  const hasContent = value.trim().length > 0 || (!imageMode && ready.length > 0);
  const canSend = hasContent && !loading && !streaming && !disabled;

  function submit() {
    if (!canSend) return;
    onSend(value, ready.map(toAttachment));
    setValue("");
    setAttachments([]);
    setNotice(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // On touch devices Enter inserts a newline; the send button submits.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    submit();
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = [...e.clipboardData.files];
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
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
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={clsx(
          "flex cursor-text flex-col gap-1.5 rounded-[28px] border bg-surface p-2.5 shadow-sm transition-colors",
          dragging ? "border-fg border-dashed" : "border-line",
        )}
      >
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-1 pt-1">
            {attachments.map((a) => (
              <li key={a.id}>
                <AttachmentChip
                  attachment={a}
                  onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                />
              </li>
            ))}
          </ul>
        )}

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
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Add files and more"
              title="Add files and more"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <Plus className="size-5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-30 mb-2 w-60 rounded-2xl border border-line bg-bg p-1.5 shadow-lg"
              >
                <MenuItem
                  icon={<Paperclip className="size-4" />}
                  onClick={() => {
                    closeMenu();
                    fileInput.current?.click();
                  }}
                >
                  Add photos & files
                </MenuItem>
                {props.allowImages !== false && (
                <MenuItem
                  icon={<ImageIcon className="size-4" />}
                  onClick={() => {
                    closeMenu();
                    onModeChange(imageMode ? "text" : "image");
                  }}
                >
                  {imageMode ? "Turn off image mode" : "Create image"}
                </MenuItem>
                )}
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
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
            onPaste={onPaste}
            placeholder={imageMode ? "Describe or edit an image" : (props.placeholder ?? "Ask anything")}
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
      <p role="status" className={clsx("px-2 py-2.5 text-center text-xs leading-4", notice ? "text-danger" : "text-muted")}>
        {notice ?? "AI replies can be wrong. Chats are not saved."}
      </p>
    </div>
  );
}

const toAttachment = ({ id, name, size, kind, dataUrl, text, truncated }: PendingAttachment): Attachment => ({
  id,
  name,
  size,
  kind,
  dataUrl,
  text,
  truncated,
});

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon}
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}
