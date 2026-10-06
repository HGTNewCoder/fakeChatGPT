import { Menu, SquarePen } from "lucide-react";
import type { GptCard } from "@/hooks/useGpts";
import { APP_NAME } from "@/lib/constants";
import { GptAvatar } from "./GptAvatar";
import { IconButton } from "./IconButton";

type Props = {
  gpt?: GptCard;
  onOpenSidebar: () => void;
  onNewChat: () => void;
};

export function TopBar({ gpt, onOpenSidebar, onNewChat }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-bg px-2 md:px-3">
      <IconButton label="Open sidebar" onClick={onOpenSidebar} className="md:hidden">
        <Menu className="size-5" />
      </IconButton>
      <h1 className="flex min-w-0 items-center gap-2 px-2.5 text-lg font-medium">
        {gpt && <GptAvatar name={gpt.name} avatar={gpt.avatar} className="size-6 text-xs" />}
        <span className="truncate">{gpt?.name ?? APP_NAME}</span>
      </h1>
      <div className="ml-auto md:hidden">
        <IconButton label="New chat" onClick={onNewChat}>
          <SquarePen className="size-5" />
        </IconButton>
      </div>
    </header>
  );
}
