import clsx from "clsx";
import type { Conversation } from "@/hooks/useChat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  filtered: boolean;
};

export function ConversationList({ conversations, activeId, onSelect, filtered }: Props) {
  return (
    <section className="pt-5 pb-2">
      <h2 className="px-2.5 pb-2 text-xs font-medium text-muted">Chats</h2>
      {conversations.length === 0 ? (
        <p className="px-2.5 text-xs leading-4 text-muted">
          {filtered ? "No matching chats." : "Chats are kept only until you leave or reload this page."}
        </p>
      ) : (
        <ul className="flex flex-col gap-px">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === activeId ? "page" : undefined}
                className={clsx(
                  "block h-9 w-full truncate rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-hover",
                  c.id === activeId && "bg-hover font-medium",
                )}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
