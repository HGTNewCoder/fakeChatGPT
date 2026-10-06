"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChatContext } from "@/components/chat/ChatProvider";
import { gptApi, SessionExpiredError } from "@/hooks/useGpts";

/** A GPT's share link: adds it to the visitor's sidebar and opens a new chat with it. */
export default function SharedGptPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const router = useRouter();
  const { chat, gpts, setPendingGptId } = useChatContext();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice in dev
    started.current = true;
    gptApi
      .openShared(shareId)
      .then(async ({ gpt }) => {
        await gpts.reload();
        chat.newChat();
        setPendingGptId(gpt.id);
        router.replace("/");
      })
      .catch((err: Error) => {
        if (err instanceof SessionExpiredError) router.replace(`/login?next=/g/${shareId}`);
        else setError(err.message);
      });
  }, [chat, gpts, router, setPendingGptId, shareId]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      {error ? (
        <>
          <p className="text-danger">{error}</p>
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to chat
          </Link>
        </>
      ) : (
        <LoaderCircle className="size-6 animate-spin text-muted" aria-label="Opening shared GPT" />
      )}
    </main>
  );
}
