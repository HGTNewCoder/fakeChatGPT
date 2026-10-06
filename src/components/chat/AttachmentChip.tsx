import clsx from "clsx";
import { FileText, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { Attachment } from "@/hooks/useChat";
import { formatBytes } from "@/lib/files";

type Props = {
  attachment: Attachment & { status?: "loading" | "ready" | "error"; error?: string };
  onRemove?: () => void;
};

/** Image thumbnail or document card; removable while still in the composer. */
export function AttachmentChip({ attachment: a, onRemove }: Props) {
  const status = a.status ?? "ready";
  const ext = a.name.includes(".") ? a.name.split(".").pop()!.toUpperCase() : "FILE";

  const remove = onRemove && (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${a.name}`}
      title="Remove"
      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm transition-opacity hover:opacity-80"
    >
      <X className="size-3" strokeWidth={2.5} />
    </button>
  );

  if (a.kind === "image") {
    return (
      <div className="relative size-14 shrink-0" title={a.error ?? a.name}>
        {a.dataUrl ? (
          // Local data URL preview; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.dataUrl} alt={a.name} className="size-full rounded-xl border border-line object-cover" />
        ) : (
          <div
            className={clsx(
              "flex size-full items-center justify-center rounded-xl border bg-bg",
              status === "error" ? "border-danger/50 text-danger" : "border-line text-muted",
            )}
          >
            {status === "error" ? <TriangleAlert className="size-5" /> : <LoaderCircle className="size-5 animate-spin" />}
          </div>
        )}
        {remove}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "relative flex h-14 w-56 max-w-full items-center gap-2.5 rounded-xl border bg-bg py-2 pr-3 pl-2",
        status === "error" ? "border-danger/50" : "border-line",
      )}
      title={a.error ?? a.name}
    >
      <span
        className={clsx(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          status === "error" ? "bg-danger/15 text-danger" : "bg-accent text-accent-fg",
        )}
      >
        {status === "loading" ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : status === "error" ? (
          <TriangleAlert className="size-5" />
        ) : (
          <FileText className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className={clsx("block truncate text-xs", status === "error" ? "text-danger" : "text-muted")}>
          {status === "error"
            ? a.error
            : status === "loading"
              ? "Reading…"
              : `${ext} · ${formatBytes(a.size)}${a.truncated ? " · truncated" : ""}`}
        </span>
      </span>
      {remove}
    </div>
  );
}
