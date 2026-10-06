"use client";

import clsx from "clsx";
import { FileText, Globe, ImageIcon, LoaderCircle, Plus, Trash2, Upload, Wand2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { GptAvatar } from "@/components/chat/GptAvatar";
import { useDismiss } from "@/components/chat/useDismiss";
import type { Gpt } from "@/hooks/useGpts";
import { ACCEPT, formatBytes, imageToAvatar } from "@/lib/files";
import { MAX_KNOWLEDGE_FILES, MAX_STARTERS } from "@/lib/validation";
import type { EditorConfig } from "./types";

type Props = {
  gpt: Gpt;
  config: EditorConfig;
  onChange: (patch: Partial<EditorConfig>) => void;
  avatarBusy: boolean;
  onGenerateAvatar: () => void;
  onAddKnowledge: (files: File[]) => Promise<void>;
  onRemoveKnowledge: (fileId: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

const field =
  "w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-fg";

/** The Configure tab: every setting of the GPT as a form. */
export function ConfigureForm(props: Props) {
  const { gpt, config, onChange } = props;
  // Always keep one empty starter row until the limit is reached.
  const starters = config.starters.length < MAX_STARTERS ? [...config.starters, ""] : config.starters;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-6">
      <AvatarPicker {...props} />

      <Field label="Name" htmlFor="gpt-name">
        <input
          id="gpt-name"
          maxLength={50}
          value={config.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Name your GPT"
          className={field}
        />
      </Field>

      <Field label="Description" htmlFor="gpt-description">
        <input
          id="gpt-description"
          maxLength={300}
          value={config.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Add a short description about what this GPT does"
          className={field}
        />
      </Field>

      <Field
        label="Instructions"
        htmlFor="gpt-instructions"
        hint={`${config.instructions.length.toLocaleString()} / 8,000`}
      >
        <textarea
          id="gpt-instructions"
          maxLength={8000}
          rows={9}
          value={config.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          placeholder="What does this GPT do? How does it behave? What should it avoid doing?"
          className={clsx(field, "resize-y leading-6")}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Conversation starters</legend>
        {starters.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              maxLength={200}
              value={s}
              onChange={(e) => {
                const next = [...starters];
                next[i] = e.target.value;
                onChange({ starters: next.filter((x, j) => x || j === i).slice(0, MAX_STARTERS) });
              }}
              onBlur={() => onChange({ starters: config.starters.filter(Boolean) })}
              aria-label={`Conversation starter ${i + 1}`}
              placeholder="Example: Help me plan a weekend trip"
              className={field}
            />
            {s && (
              <button
                type="button"
                onClick={() => onChange({ starters: config.starters.filter((_, j) => j !== i) })}
                aria-label={`Remove starter ${i + 1}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-fg"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </fieldset>

      <Knowledge {...props} />

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-semibold">Capabilities</legend>
        <Capability
          icon={<Globe className="size-4" />}
          label="Web Search"
          checked={config.capabilities.webSearch}
          onChange={(webSearch) => onChange({ capabilities: { ...config.capabilities, webSearch } })}
        />
        <Capability
          icon={<ImageIcon className="size-4" />}
          label="Image Generation"
          checked={config.capabilities.imageGeneration}
          onChange={(imageGeneration) => onChange({ capabilities: { ...config.capabilities, imageGeneration } })}
        />
      </fieldset>

      <DeleteGpt published={gpt.status === "published"} onDelete={props.onDelete} />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function AvatarPicker({ config, onChange, avatarBusy, onGenerateAvatar }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Change profile picture"
          className="group relative flex size-20 items-center justify-center rounded-full border-2 border-dashed border-line transition-colors hover:border-fg"
        >
          {avatarBusy ? (
            <LoaderCircle className="size-6 animate-spin text-muted" />
          ) : config.avatar ? (
            <GptAvatar name={config.name} avatar={config.avatar} className="size-full" />
          ) : (
            <Plus className="size-7 text-muted group-hover:text-fg" />
          )}
        </button>
        {open && (
          <div
            role="menu"
            className="absolute top-full left-1/2 z-20 mt-2 w-52 -translate-x-1/2 rounded-2xl border border-line bg-bg p-1.5 shadow-lg"
          >
            <MenuButton
              icon={<Upload className="size-4" />}
              onClick={() => {
                close();
                fileInput.current?.click();
              }}
            >
              Upload photo
            </MenuButton>
            <MenuButton
              icon={<Wand2 className="size-4" />}
              onClick={() => {
                close();
                onGenerateAvatar();
              }}
            >
              Generate
            </MenuButton>
            {config.avatar && (
              <MenuButton
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  close();
                  onChange({ avatar: "" });
                }}
              >
                Remove
              </MenuButton>
            )}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              setError(null);
              onChange({ avatar: await imageToAvatar(file) });
            } catch {
              setError("Couldn't read that image");
            }
          }}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function MenuButton({ icon, children, onClick }: { icon: React.ReactNode; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-sm transition-colors hover:bg-hover"
    >
      {icon}
      {children}
    </button>
  );
}

function Knowledge({ gpt, onAddKnowledge, onRemoveKnowledge }: Props) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const full = gpt.knowledge.length + uploading >= MAX_KNOWLEDGE_FILES;

  async function add(files: File[]) {
    setError(null);
    setUploading((n) => n + files.length);
    try {
      await onAddKnowledge(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading((n) => n - files.length);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Knowledge</h3>
      <p className="text-xs leading-5 text-muted">
        If you upload files under Knowledge, conversations with your GPT may include file contents. The most
        relevant passages are looked up for each message. PDF, DOCX and text files, up to 4 MB each,{" "}
        {MAX_KNOWLEDGE_FILES} files.
      </p>
      {gpt.knowledge.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {gpt.knowledge.map((k) => (
            <li
              key={k.id}
              title={k.name}
              className="relative flex h-14 w-56 max-w-full items-center gap-2.5 rounded-xl border border-line bg-bg py-2 pr-3 pl-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{k.name}</span>
                <span className="block text-xs text-muted">
                  {formatBytes(k.size)}
                  {k.truncated ? " · truncated" : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemoveKnowledge(k.id).catch((err: Error) => setError(err.message))}
                aria-label={`Remove ${k.name}`}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm hover:opacity-80"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          disabled={full}
          onClick={() => fileInput.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line px-4 text-sm transition-colors hover:bg-hover disabled:opacity-40"
        >
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : "Upload files"}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT.split(",").filter((t) => !t.startsWith("image/")).join(",")}
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void add(files);
          }}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}

function Capability({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--accent)]"
      />
      <span className="text-muted">{icon}</span>
      {label}
    </label>
  );
}

function DeleteGpt({ published, onDelete }: { published: boolean; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 border-t border-line pt-6">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirming) return setConfirming(true);
          setBusy(true);
          await onDelete().catch(() => setBusy(false));
        }}
        className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
        {confirming ? "Click again to delete permanently" : published ? "Delete GPT" : "Discard draft"}
      </button>
      {confirming && !busy && (
        <button type="button" onClick={() => setConfirming(false)} className="text-sm text-muted hover:text-fg">
          Cancel
        </button>
      )}
    </div>
  );
}
