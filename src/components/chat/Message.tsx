import clsx from "clsx";
import { Download, ImageIcon, RotateCcw } from "lucide-react";
import type { Message } from "@/hooks/useChat";
import { IMAGE_SIZE_OPTIONS } from "@/lib/constants";
import { CopyButton } from "./CopyButton";
import { Markdown } from "./Markdown";

export function UserMessage({ message }: { message: Message }) {
  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-3xl bg-surface px-5 py-2.5 text-base leading-7 break-words whitespace-pre-wrap md:max-w-[70%]">
        {message.image && (
          <span className="mb-0.5 flex items-center gap-1.5 text-xs leading-5 text-muted">
            <ImageIcon className="size-3.5" />
            Image
          </span>
        )}
        {message.content}
      </div>
      <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton getText={() => message.content} />
      </div>
    </div>
  );
}

type AssistantProps = { message: Message; streaming: boolean; isLast: boolean; onRetry: () => void };

export function AssistantMessage({ message, streaming, isLast, onRetry }: AssistantProps) {
  const pending = streaming && !message.content;
  const done = !streaming && message.content && !message.error;

  return (
    <div className="flex flex-col gap-1">
      {message.image ? (
        <GeneratedImage image={message.image} pending={streaming} failed={Boolean(message.error)} />
      ) : pending ? (
        <span className="caret h-7" aria-label="Thinking" />
      ) : (
        message.content && (
          <div className={clsx("markdown", streaming && "streaming")}>
            <Markdown content={message.content} />
          </div>
        )
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

      {done && (
        <div className="-ml-2 flex">
          <CopyButton getText={() => message.content} />
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
  const { request, result } = image;
  if (failed && !result) return null;

  const aspect = IMAGE_SIZE_OPTIONS.find((o) => o.id === request.size)?.aspect ?? "aspect-square";

  if (!result) {
    return (
      <div
        role="status"
        className={clsx(
          "flex w-full max-w-[400px] animate-pulse items-center justify-center rounded-2xl bg-surface text-sm text-muted",
          aspect,
        )}
      >
        {pending ? "Creating image…" : "No image"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <a href={result.url} target="_blank" rel="noreferrer noopener" className="block w-full max-w-[400px]">
        {/* Remote, one-off images: next/image optimization adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.url}
          width={result.width}
          height={result.height}
          alt={request.prompt}
          className="h-auto w-full rounded-2xl bg-surface"
        />
      </a>
      <div className="-ml-2 flex">
        <a
          href={result.url}
          download
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Download image"
          title="Download image"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Download className="size-4" />
        </a>
        <CopyButton getText={() => request.prompt} label="Copy prompt" />
      </div>
    </div>
  );
}
