import clsx from "clsx";
import { ChevronDown, Download, Globe, ImageIcon, RotateCcw } from "lucide-react";
import type { Message } from "@/hooks/useChat";
import { IMAGE_SIZE_OPTIONS } from "@/lib/constants";
import { AttachmentChip } from "./AttachmentChip";
import { CopyButton } from "./CopyButton";
import { Markdown } from "./Markdown";

export function UserMessage({ message }: { message: Message }) {
  const attachments = message.attachments ?? [];
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");

  return (
    <div className="group flex flex-col items-end gap-1">
      {images.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2 md:max-w-[70%]">
          {images.map((a) => (
            // Local data URL; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={a.dataUrl}
              alt={a.name}
              className={clsx(
                "rounded-2xl border border-line object-cover",
                images.length === 1 ? "max-h-72 w-auto max-w-full" : "size-32",
              )}
            />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2 md:max-w-[70%]">
          {files.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
        </div>
      )}
      {(message.content || message.imageSize) && (
        <div className="max-w-[85%] rounded-3xl bg-surface px-5 py-2.5 text-base leading-7 break-words whitespace-pre-wrap md:max-w-[70%]">
          {message.imageSize && (
            <span className="mb-0.5 flex items-center gap-1.5 text-xs leading-5 text-muted">
              <ImageIcon className="size-3.5" />
              Image
            </span>
          )}
          {message.content}
        </div>
      )}
      {message.content && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton getText={() => message.content} />
        </div>
      )}
    </div>
  );
}

type AssistantProps = { message: Message; streaming: boolean; isLast: boolean; onRetry: () => void };

export function AssistantMessage({ message, streaming, isLast, onRetry }: AssistantProps) {
  const searching = streaming && message.searching;
  const pending = streaming && !message.content && !message.image && !searching;
  const done = !streaming && message.content && !message.error;

  return (
    <div className="flex flex-col gap-1">
      {pending && <span className="caret h-7" aria-label="Thinking" />}
      {searching && (
        <p role="status" className="flex h-7 items-center gap-2 text-sm text-muted">
          <Globe className="size-4 animate-pulse" />
          <span className="truncate">Searching the web for “{message.searches?.at(-1)}”…</span>
        </p>
      )}
      {message.content && (
        <div className={clsx("markdown", streaming && !message.image && "streaming")}>
          <Markdown content={message.content} />
        </div>
      )}
      {message.image && (
        <GeneratedImage image={message.image} pending={streaming} failed={Boolean(message.error)} />
      )}

      {message.error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 px-4 py-3 text-sm text-danger">
          <span className="flex-1">{message.error}</span>
          {isLast && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-fg transition-colors hover:bg-hover"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </button>
          )}
        </div>
      )}

      {done && !message.image && (
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          <CopyButton getText={() => message.content} />
          {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}
        </div>
      )}
    </div>
  );
}

function GeneratedImage({
  image,
  pending,
  failed,
}: {
  image: NonNullable<Message["image"]>;
  pending: boolean;
  failed: boolean;
}) {
  if (failed && !image.url) return null;

  const aspect = IMAGE_SIZE_OPTIONS.find((o) => o.id === image.size)?.aspect ?? "aspect-square";

  if (!image.url) {
    return (
      <div
        role="status"
        className={clsx(
          "flex w-full max-w-[400px] animate-pulse items-center justify-center rounded-2xl bg-surface text-sm text-muted",
          aspect,
        )}
      >
        {pending ? (image.edit ? "Editing image…" : "Creating image…") : "No image"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <a href={image.url} target="_blank" rel="noreferrer noopener" className="block w-full max-w-[400px]">
        {/* Remote, one-off images: next/image optimization adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          width={image.width}
          height={image.height}
          alt={image.prompt}
          className="h-auto w-full rounded-2xl bg-surface"
        />
      </a>
      <div className="-ml-2 flex">
        <a
          href={image.url}
          download
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Download image"
          title="Download image"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Download className="size-4" />
        </a>
        <CopyButton getText={() => image.prompt} label="Copy prompt" />
      </div>
      {/* The model rewrites short requests into a detailed prompt; show what was actually used. */}
      <details className="group max-w-[400px] text-xs text-muted">
        <summary className="w-fit cursor-pointer list-none rounded-md py-0.5 hover:text-fg">
          <span className="group-open:hidden">Show prompt</span>
          <span className="hidden group-open:inline">Hide prompt</span>
        </summary>
        <p className="mt-1 leading-5 whitespace-pre-wrap">{image.prompt}</p>
      </details>
    </div>
  );
}

// Like ChatGPT's "Sources" button: the pages DeepSeek's web search returned for this reply.
function Sources({ sources }: { sources: NonNullable<Message["sources"]> }) {
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  return (
    <details className="group w-full">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-hover hover:text-fg">
        <Globe className="size-4" />
        Sources · {sources.length}
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-1 ml-2 flex flex-col gap-1 border-l border-line pl-3">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group/link flex flex-col rounded-lg px-2 py-1.5 transition-colors hover:bg-hover"
            >
              <span className="text-xs text-muted">{host(s.url)}</span>
              <span className="line-clamp-1 text-sm group-hover/link:underline">{s.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
