import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { chatSchema, firstIssue } from "@/lib/validation";

const SYSTEM_PROMPT =
  "You are a helpful assistant. Answer clearly and concisely. Use Markdown for formatting when it helps.";

export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = chatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY is not configured" }, { status: 500 });
  }
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = parsed.data.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...parsed.data.messages],
      }),
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach DeepSeek" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("DeepSeek error", upstream.status, detail);
    return NextResponse.json(
      { error: `DeepSeek request failed (${upstream.status})` },
      { status: upstream.status === 401 ? 500 : 502 },
    );
  }

  return new Response(upstream.body.pipeThrough(sseToText()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

// Turns DeepSeek's OpenAI-style SSE stream into a stream of plain content text.
function sseToText() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const content = JSON.parse(data).choices?.[0]?.delta?.content;
      if (content) controller.enqueue(encoder.encode(content));
    } catch {
      // ignore keep-alive or malformed lines
    }
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line, controller);
    },
    flush(controller) {
      handleLine(buffer, controller);
    },
  });
}
