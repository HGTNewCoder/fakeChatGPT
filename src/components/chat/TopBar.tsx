import { Menu, SquarePen } from "lucide-react";
import type { ModelId } from "@/lib/validation";
import { IconButton } from "./IconButton";
import { ModelSelector } from "./ModelSelector";

type Props = {
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  onOpenSidebar: () => void;
  onNewChat: () => void;
};

export function TopBar({ model, onModelChange, onOpenSidebar, onNewChat }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 bg-bg px-2 md:px-3">
      <IconButton label="Open sidebar" onClick={onOpenSidebar} className="md:hidden">
        <Menu className="size-5" />
      </IconButton>
      <ModelSelector value={model} onChange={onModelChange} />
      <div className="ml-auto md:hidden">
        <IconButton label="New chat" onClick={onNewChat}>
          <SquarePen className="size-5" />
        </IconButton>
      </div>
    </header>
  );
}
