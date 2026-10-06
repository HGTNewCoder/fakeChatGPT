import "server-only";

/** POSTs to DeepSeek's Anthropic-compatible Messages endpoint. Throws a user-facing error on failure. */
export async function deepseekMessages(body: object, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new UpstreamError("DEEPSEEK_API_KEY is not configured", 500);
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/anthropic/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        max_tokens: 8192,
        stream: true,
        ...body,
      }),
      signal,
    });
  } catch {
    throw new UpstreamError("Could not reach DeepSeek", 502);
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("DeepSeek error", res.status, detail);
    throw new UpstreamError(`DeepSeek request failed (${res.status})`, res.status === 401 ? 500 : 502);
  }
  return res.body;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function parseJson<T>(json: string): Partial<T> {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

// Yields each `data:` payload of an Anthropic-style SSE stream (events are separated by blank lines).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (chunk: string) => {
    const data = chunk
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const event = parse(chunk);
      if (event) yield event;
    }
  }
  const event = parse(buffer);
  if (event) yield event;
}
