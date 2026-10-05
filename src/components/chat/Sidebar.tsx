"use client";

import clsx from "clsx";
import { PanelLeft, Search, SquarePen, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation } from "@/hooks/useChat";
import type { SessionUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { ConversationList } from "./ConversationList";
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
};

/**
 * < md: off-canvas drawer (260px) over a dimmed overlay.
 * ≥ md: static column, 260px expanded or a 52px icon rail when collapsed.
 */
export function Sidebar(props: Props) {
  const { collapsed, mobileOpen, onCloseMobile } = props;
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseMobile();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  // Labels are hidden only in the desktop rail; the mobile drawer is always expanded.
  const label = clsx(collapsed && "md:hidden");

  const visible = query
    ? props.conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : props.conversations;

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
          {searching && !collapsed ? (
            <div className="flex h-9 items-center gap-2.5 rounded-lg bg-hover px-2.5">
              <Search className="size-[18px] shrink-0 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => !query && setSearching(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setSearching(false);
                  }
                }}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
          ) : (
            <SidebarRow
              icon={<Search className="size-[18px]" />}
              onClick={() => {
                if (collapsed) props.onToggleCollapsed();
                setSearching(true);
              }}
              labelClass={label}
            >
              Search chats
            </SidebarRow>
          )}
        </nav>

        {/* Conversations */}
        <div className={clsx("min-h-0 flex-1 overflow-y-auto px-2", collapsed && "md:invisible")}>
          <ConversationList
            conversations={visible}
            activeId={props.activeId}
            onSelect={props.onSelect}
            filtered={Boolean(query)}
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
