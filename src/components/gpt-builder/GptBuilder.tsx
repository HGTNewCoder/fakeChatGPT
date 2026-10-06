"use client";

import clsx from "clsx";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatContext } from "@/components/chat/ChatProvider";
import { GptAvatar } from "@/components/chat/GptAvatar";
import { IconButton } from "@/components/chat/IconButton";
import { gptApi, SessionExpiredError, type Gpt } from "@/hooks/useGpts";
import { BuilderChat } from "./BuilderChat";
import { ConfigureForm } from "./ConfigureForm";
import { Preview } from "./Preview";
import { SharePopover } from "./SharePopover";
import { configOf, type BuilderPatch, type EditorConfig } from "./types";

// "Unsaved" isn't a state of its own: it's derived from config differing from what was last saved.
type SaveState = "idle" | "saving" | "error";

const AUTOSAVE_MS = 800;
const same = (a: EditorConfig, b: EditorConfig) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The GPT editor, modeled on ChatGPT's /gpts/editor: Create (GPT Builder chat) and Configure tabs on
 * the left, a live Preview on the right. Drafts autosave; a published GPT changes only on Update.
 */
export function GptBuilder({ id }: { id: string }) {
  const router = useRouter();
  const { gpts, pendingGptId, setPendingGptId } = useChatContext();
  const [gpt, setGpt] = useState<Gpt | null>(null);
  const [config, setConfig] = useState<EditorConfig | null>(null);
  const [saved, setSaved] = useState<EditorConfig | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "configure">("create");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Latest config for async callbacks (autosave, avatar) without re-creating them on every keystroke.
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof SessionExpiredError) router.replace("/login");
      setError(err instanceof Error ? err.message : "Something went wrong");
    },
    [router],
  );

  useEffect(() => {
    gptApi
      .get(id)
      .then((g) => {
        setGpt(g);
        setConfig(configOf(g));
        setSaved(configOf(g));
        // An existing GPT opens on its settings; a fresh draft starts with the Builder.
        if (g.name || g.instructions) setTab("configure");
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) router.replace("/login");
        setLoadError(err instanceof Error ? err.message : "Couldn't open this GPT");
      });
  }, [id, router]);

  const isDraft = gpt?.status !== "published";
  const dirty = Boolean(config && saved && !same(config, saved));

  const save = useCallback(
    async (publish = false) => {
      const snapshot = configRef.current;
      if (!snapshot) return null;
      setSaveState("saving");
      setError(null);
      try {
        const g = await gptApi.update(id, { ...snapshot, publish });
        setGpt(g);
        setSaved(configOf(g));
        setSaveState("idle");
        return g;
      } catch (err) {
        setSaveState("error");
        fail(err);
        return null;
      }
    },
    [fail, id],
  );

  // Drafts autosave shortly after each change, like ChatGPT's builder.
  useEffect(() => {
    if (!dirty || !isDraft) return;
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [config, dirty, isDraft, save]);

  const change = (patch: Partial<EditorConfig>) => setConfig((c) => (c ? { ...c, ...patch } : c));

  const generateAvatar = async () => {
    const c = configRef.current;
    if (!c) return;
    setAvatarBusy(true);
    setError(null);
    try {
      const g = await gptApi.generateAvatar(id, { name: c.name, description: c.description });
      // The server stores the picture right away, so it is saved either way.
      change({ avatar: g.avatar });
      setSaved((s) => (s ? { ...s, avatar: g.avatar } : s));
      setGpt((prev) => (prev ? { ...prev, avatar: g.avatar } : g));
    } catch (err) {
      fail(err);
    } finally {
      setAvatarBusy(false);
    }
  };

  const applyBuilderPatch = ({ regenerate_avatar, capabilities, ...fields }: BuilderPatch) => {
    setConfig((c) =>
      c ? { ...c, ...fields, ...(capabilities && { capabilities: { ...c.capabilities, ...capabilities } }) } : c,
    );
    // Wait a tick so the avatar prompt uses the name the Builder just set.
    if (regenerate_avatar) setTimeout(() => void generateAvatar(), 0);
  };

  const publish = async () => {
    setPublishing(true);
    const g = await save(true);
    setPublishing(false);
    if (!g) return;
    await gpts.reload();
    if (isDraft) {
      // Like ChatGPT: after Create, jump straight into a chat with the new GPT.
      setPendingGptId(g.id);
      router.push("/");
    }
  };

  const remove = async () => {
    try {
      await gptApi.remove(id);
    } catch (err) {
      fail(err);
      throw err;
    }
    await gpts.reload();
    if (pendingGptId === id) setPendingGptId(undefined);
    router.push("/");
  };

  const back = () => {
    if (!isDraft && dirty && !window.confirm("Discard your unsaved changes?")) return;
    router.push("/");
  };

  if (loadError) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
        <p className="text-danger">{loadError}</p>
        <button type="button" onClick={() => router.push("/")} className="text-sm underline">
          Back to chat
        </button>
      </main>
    );
  }
  if (!gpt || !config) {
    return (
      <main className="flex h-dvh items-center justify-center bg-bg text-muted">
        <LoaderCircle className="size-6 animate-spin" aria-label="Loading" />
      </main>
    );
  }

  const status =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Couldn't save"
        : isDraft
          ? dirty
            ? "Draft"
            : "Draft · Saved"
          : dirty
            ? "Unsaved changes"
            : "Published";

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2 md:px-4">
        <IconButton label="Back to chat" onClick={back}>
          <ArrowLeft className="size-5" />
        </IconButton>
        <GptAvatar name={config.name || "?"} avatar={config.avatar} className="size-8 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{config.name || "New GPT"}</p>
          <p className={clsx("text-xs", saveState === "error" ? "text-danger" : "text-muted")}>{status}</p>
        </div>

        <div role="tablist" className="flex rounded-full bg-surface p-1 md:hidden">
          {(["edit", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={mobileView === v}
              onClick={() => setMobileView(v)}
              className={clsx(
                "h-7 rounded-full px-3 text-xs font-medium capitalize transition-colors",
                mobileView === v ? "bg-bg shadow-sm" : "text-muted",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <SharePopover
          gpt={gpt}
          onChange={async (visibility) => {
            // Only visibility is sent, so unsaved edits to a created GPT stay unsaved.
            const g = await gptApi.update(id, { visibility });
            setGpt((prev) => (prev ? { ...prev, visibility: g.visibility, shareId: g.shareId } : g));
            await gpts.reload();
          }}
        />

        <button
          type="button"
          onClick={publish}
          disabled={publishing || saveState === "saving" || (!isDraft && !dirty) || !config.name.trim() || !config.instructions.trim()}
          title={!config.name.trim() || !config.instructions.trim() ? "Add a name and instructions first" : undefined}
          className="h-9 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg transition-opacity hover:opacity-85 disabled:opacity-35"
        >
          {publishing ? "Saving…" : isDraft ? "Create" : "Update"}
        </button>
      </header>

      {error && (
        <p role="alert" className="border-b border-danger/30 bg-danger/5 px-4 py-2 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Edit GPT"
          className={clsx(
            "min-w-0 flex-1 flex-col border-line md:flex md:w-1/2 md:flex-none md:border-r",
            mobileView === "edit" ? "flex" : "hidden",
          )}
        >
          <div role="tablist" className="flex shrink-0 justify-center pt-4">
            <div className="flex rounded-full bg-surface p-1">
              {(["create", "configure"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "h-8 rounded-full px-5 text-sm font-medium capitalize transition-colors",
                    tab === t ? "bg-bg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* Both tabs stay mounted so the Builder conversation survives switching to Configure. */}
          <div className={clsx("min-h-0 flex-1", tab === "create" ? "block" : "hidden")}>
            <BuilderChat config={config} onPatch={applyBuilderPatch} />
          </div>
          <div className={clsx("min-h-0 flex-1 overflow-y-auto", tab === "configure" ? "block" : "hidden")}>
            <ConfigureForm
              gpt={gpt}
              config={config}
              onChange={change}
              avatarBusy={avatarBusy}
              onGenerateAvatar={generateAvatar}
              onAddKnowledge={async (files) => {
                for (const file of files) {
                  const g = await gptApi.addKnowledge(id, file).catch((err) => {
                    if (err instanceof SessionExpiredError) router.replace("/login");
                    throw err;
                  });
                  setGpt((prev) => (prev ? { ...prev, knowledge: g.knowledge } : g));
                }
              }}
              onRemoveKnowledge={async (fileId) => {
                const g = await gptApi.removeKnowledge(id, fileId);
                setGpt((prev) => (prev ? { ...prev, knowledge: g.knowledge } : g));
              }}
              onDelete={remove}
            />
          </div>
        </section>

        <section
          aria-label="Preview"
          className={clsx(
            "min-w-0 flex-1 flex-col bg-sidebar md:flex",
            mobileView === "preview" ? "flex" : "hidden",
          )}
        >
          <Preview gptId={id} config={config} />
        </section>
      </div>
    </div>
  );
}
