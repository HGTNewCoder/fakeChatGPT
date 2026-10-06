"use client";

import clsx from "clsx";
import { PanelLeft, Pencil, Plus, SquarePen, X } from "lucide-react";
import { useEffect } from "react";
import type { Conversation } from "@/hooks/useChat";
import type { Gpt, SharedGpt } from "@/hooks/useGpts";
import type { SessionUser } from "@/lib/auth";
import type { BuiltinGptCard } from "@/lib/builtinGptCards";
import { APP_NAME } from "@/lib/constants";
import { ConversationList } from "./ConversationList";
import { GptAvatar } from "./GptAvatar";
import { IconButton } from "./IconButton";
import { UserMenu } from "./UserMenu";

type Props = {
  user: SessionUser;
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  /** GPTs that ship with the app, listed right under New chat. */
  builtins: BuiltinGptCard[];
  gpts: Gpt[];
  /** Other people's GPTs the user opened through a share link. */
  shared: SharedGpt[];
  onHideShared: (gpt: SharedGpt) => void;
  /** GPT of the chat on screen, highlighted in the list. */
  currentGptId?: string;
  onStartGpt: (id: string) => void;
  onEditGpt: (gpt: Gpt) => void;
  onCreateGpt: () => void;
};

/**
 * < md: off-canvas drawer (260px) over a dimmed overlay.
 * ≥ md: static column, 260px expanded or a 52px icon rail when collapsed.
 */
export function Sidebar(props: Props) {
  const { collapsed, mobileOpen, onCloseMobile } = props;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseMobile();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  // Labels are hidden only in the desktop rail; the mobile drawer is always expanded.
  const label = clsx(collapsed && "md:hidden");

  return (
    <>
      <div
        aria-hidden
        onClick={onCloseMobile}
        className={clsx(
          "fixed inset-0 z-30 bg-overlay transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label="Sidebar"
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] max-w-[85vw] flex-col bg-sidebar transition-transform duration-200",
          "md:static md:max-w-none md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-[52px]" : "md:w-[260px]",
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-2">
          <span className={clsx("px-2 text-sm font-semibold tracking-tight", label)}>{APP_NAME}</span>
          <IconButton label="Close sidebar" onClick={onCloseMobile} className="md:hidden">
            <X className="size-5" />
          </IconButton>
          <div className="hidden md:block">
            <IconButton label={collapsed ? "Open sidebar" : "Close sidebar"} onClick={props.onToggleCollapsed}>
              <PanelLeft className="size-5" />
            </IconButton>
          </div>
        </div>

        {/* Primary actions */}
        <nav className="flex flex-col gap-px px-2">
          <SidebarRow icon={<SquarePen className="size-[18px]" />} onClick={props.onNewChat} labelClass={label}>
            New chat
          </SidebarRow>
          {props.builtins.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => props.onStartGpt(g.id)}
              title={g.description}
              aria-current={g.id === props.currentGptId ? "page" : undefined}
              className={clsx(
                "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors hover:bg-hover",
                g.id === props.currentGptId && "bg-hover font-medium",
              )}
            >
              <GptAvatar name={g.name} avatar={g.avatar} className="size-[22px] text-[10px]" />
              <span className={clsx("truncate", label)}>{g.name}</span>
            </button>
          ))}
        </nav>

        {/* GPTs + conversations */}
        <div className={clsx("min-h-0 flex-1 overflow-y-auto px-2", collapsed && "md:invisible")}>
          <section className="pt-5">
            <h2 className="px-2.5 pb-2 text-xs font-medium text-muted">GPTs</h2>
            <ul className="flex flex-col gap-px">
              {props.gpts.map((g) => (
                <li key={g.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => props.onStartGpt(g.id)}
                    title={g.description || g.name}
                    className={clsx(
                      "flex h-9 w-full items-center gap-2.5 rounded-lg pr-9 pl-2 text-left text-sm transition-colors hover:bg-hover",
                      g.id === props.currentGptId && "bg-hover font-medium",
                    )}
                  >
                    <GptAvatar name={g.name} avatar={g.avatar} className="size-6 text-xs" />
                    <span className="truncate">{g.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onEditGpt(g)}
                    aria-label={`Edit ${g.name}`}
                    title="Edit GPT"
                    className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 pointer-coarse:opacity-100"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </li>
              ))}
              {props.shared.map((g) => (
                <li key={g.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => props.onStartGpt(g.id)}
                    title={`${g.name} · by ${g.author}`}
                    className={clsx(
                      "flex h-9 w-full items-center gap-2.5 rounded-lg pr-9 pl-2 text-left text-sm transition-colors hover:bg-hover",
                      g.id === props.currentGptId && "bg-hover font-medium",
                    )}
                  >
                    <GptAvatar name={g.name} avatar={g.avatar} className="size-6 text-xs" />
                    <span className="truncate">{g.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onHideShared(g)}
                    aria-label={`Remove ${g.name} from sidebar`}
                    title="Remove from sidebar"
                    className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 pointer-coarse:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={props.onCreateGpt}
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors hover:bg-hover"
                >
                  <span className="flex size-6 items-center justify-center rounded-full border border-line">
                    <Plus className="size-3.5" />
                  </span>
                  Create a GPT
                </button>
              </li>
            </ul>
          </section>
          <ConversationList
            conversations={props.conversations}
            activeId={props.activeId}
            onSelect={props.onSelect}
            onDelete={props.onDelete}
          />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-line p-2">
          <UserMenu user={props.user} collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

function SidebarRow({
  icon,
  children,
  onClick,
  labelClass,
}: {
  icon: React.ReactNode;
  children: string;
  onClick: () => void;
  labelClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={children}
      className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-hover"
    >
      <span className="shrink-0">{icon}</span>
      <span className={clsx("truncate", labelClass)}>{children}</span>
    </button>
  );
}
