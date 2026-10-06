"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gptApi } from "@/hooks/useGpts";

/** Like /gpts/create in ChatGPT: opens (or resumes) a draft, then shows its editor. */
export default function NewGptPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice in dev
    started.current = true;
    gptApi
      .openDraft()
      .then((gpt) => router.replace(`/gpts/editor/${gpt.id}`))
      .catch((err: Error) => setError(err.message));
  }, [router]);

  return (
    <main className="flex h-dvh items-center justify-center bg-bg px-4 text-sm text-muted">
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : (
        <LoaderCircle className="size-6 animate-spin" aria-label="Opening the GPT builder" />
      )}
    </main>
  );
}
