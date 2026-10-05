"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Message } from "@/hooks/useChat";
import { AssistantMessage, UserMessage } from "./Message";

const STICK_THRESHOLD = 80;

type Props = { messages: Message[]; streaming: boolean; onRetry: () => void };

export function Thread({ messages, streaming, onRetry }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // Follow new content unless the user has scrolled up to read.
  useLayoutEffect(() => {
    if (stick.current) scrollToBottom();
  }, [messages]);

  // A newly sent message always snaps back to the bottom.
  const count = messages.length;
  useEffect(() => {
    stick.current = true;
    scrollToBottom("smooth");
  }, [count]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    stick.current = bottom;
    setAtBottom(bottom);
  }

  const lastIndex = messages.length - 1;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-4 pb-10 md:px-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <UserMessage key={m.id} message={m} />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                streaming={streaming && i === lastIndex}
                isLast={i === lastIndex}
                onRetry={onRetry}
              />
            ),
          )}
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            stick.current = true;
            scrollToBottom("smooth");
          }}
          aria-label="Scroll to bottom"
          className="absolute bottom-3 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-bg shadow-md transition-colors hover:bg-hover"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
