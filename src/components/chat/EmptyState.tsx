import type { GptCard } from "@/hooks/useGpts";
import { GptAvatar } from "./GptAvatar";

type Props = {
  gpt?: GptCard;
  onStarter: (text: string) => void;
  children: React.ReactNode;
};

// Mobile: heading centered, composer docked at the bottom.
// Desktop: heading + composer centered together as one group.
export function EmptyState({ gpt, onStarter, children }: Props) {
  return (
    <div className="flex flex-1 flex-col md:justify-center md:pb-[12vh]">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 md:mb-7 md:flex-none">
        {gpt ? (
          <>
            <GptAvatar name={gpt.name} avatar={gpt.avatar} className="size-16 text-2xl" />
            <h2 className="text-center text-2xl font-semibold">{gpt.name}</h2>
            {gpt.description && (
              <p className="max-w-md text-center text-sm text-muted">{gpt.description}</p>
            )}
            {gpt.author && <p className="text-xs text-muted">By {gpt.author}</p>}
          </>
        ) : (
          <h2 className="text-center text-[28px] leading-[34px] font-medium md:text-[32px] md:leading-[40px]">
            How can I help today?
          </h2>
        )}
      </div>

      {gpt && gpt.starters.length > 0 && (
        <ul className="mx-auto mb-4 grid w-full max-w-3xl grid-cols-1 gap-2 px-4 sm:grid-cols-2 md:px-6">
          {gpt.starters.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onStarter(s)}
                className="line-clamp-2 h-full w-full rounded-2xl border border-line px-4 py-3 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}
