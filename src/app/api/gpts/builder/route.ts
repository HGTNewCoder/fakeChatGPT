import { NextResponse } from "next/server";
import { deepseekMessages, parseJson, readEvents, UpstreamError } from "@/lib/anthropic";
import { getCurrentUser } from "@/lib/auth";
import { BUILDER_PROMPT, UPDATE_GPT_TOOL } from "@/lib/chatTools";
import { builderSchema, firstIssue, MAX_STARTERS } from "@/lib/validation";

export const maxDuration = 60;

type Patch = {
  name?: string;
  description?: string;
  instructions?: string;
  starters?: string[];
  capabilities?: { webSearch?: boolean; imageGeneration?: boolean };
  regenerate_avatar?: boolean;
};

// Clamps whatever the model sends to what the GPT form accepts.
function clean(patch: Patch): Patch {
  const out: Patch = {};
  if (typeof patch.name === "string") out.name = patch.name.trim().slice(0, 50);
  if (typeof patch.description === "string") out.description = patch.description.trim().slice(0, 300);
  if (typeof patch.instructions === "string") out.instructions = patch.instructions.trim().slice(0, 8000);
  if (Array.isArray(patch.starters)) {
    out.starters = patch.starters
      .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
      .map((s) => s.trim().slice(0, 200))
      .slice(0, MAX_STARTERS);
  }
  if (patch.capabilities && typeof patch.capabilities === "object") {
    out.capabilities = {
      ...(typeof patch.capabilities.webSearch === "boolean" && { webSearch: patch.capabilities.webSearch }),
      ...(typeof patch.capabilities.imageGeneration === "boolean" && {
        imageGeneration: patch.capabilities.imageGeneration,
      }),
    };
  }
  if (patch.regenerate_avatar === true) out.regenerate_avatar = true;
  return out;
}

type Block = { type: string; id?: string; name?: string; text: string; json: string };

/**
 * Streams the GPT Builder's reply as NDJSON: {type:"text"} deltas and {type:"config", patch} when it
 * edits the GPT. After an edit the model is called once more so it can say what it changed.
 */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = builderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { config, messages: history } = parsed.data;

  const current = { ...config, capabilities: { ...config.capabilities } };
  const messages: { role: "user" | "assistant"; content: unknown }[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const request = () =>
    deepseekMessages(
      {
        system: `${BUILDER_PROMPT}\n\nCurrent configuration (JSON):\n${JSON.stringify(current, null, 2)}`,
        messages,
        tools: [UPDATE_GPT_TOOL],
      },
      req.signal,
    );

  let body: ReadableStream<Uint8Array>;
  try {
    body = await request();
  } catch (err) {
    if (err instanceof UpstreamError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let wroteText = false;
      try {
        // Round 1: reply, maybe with an update_gpt call. Round 2: a short follow-up after the edit.
        for (let round = 0; round < 2; round++) {
          const blocks = new Map<number, Block>();
          for await (const event of readEvents(body)) {
            if (event.type === "content_block_start") {
              const b = event.content_block;
              blocks.set(event.index, { type: b.type, id: b.id, name: b.name, text: "", json: "" });
              if (b.type === "text" && wroteText) emit({ type: "text", text: "\n\n" });
            } else if (event.type === "content_block_delta") {
              const block = blocks.get(event.index);
              if (!block) continue;
              if (event.delta.type === "text_delta" && event.delta.text) {
                block.text += event.delta.text;
                emit({ type: "text", text: event.delta.text });
                wroteText = true;
              } else if (event.delta.type === "input_json_delta") {
                block.json += event.delta.partial_json ?? "";
              }
            } else if (event.type === "error") {
              throw new Error(event.error?.message ?? "DeepSeek stream error");
            }
          }

          const call = [...blocks.values()].find((b) => b.type === "tool_use" && b.name === "update_gpt");
          if (!call || round === 1) break;

          const patch = clean(parseJson<Patch>(call.json));
          emit({ type: "config", patch });
          if (patch.name !== undefined) current.name = patch.name;
          if (patch.description !== undefined) current.description = patch.description;
          if (patch.instructions !== undefined) current.instructions = patch.instructions;
          if (patch.starters !== undefined) current.starters = patch.starters;
          if (patch.capabilities) Object.assign(current.capabilities, patch.capabilities);

          // Replay the turn with the tool result so the model can describe the change.
          const text = [...blocks.values()]
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
          messages.push({
            role: "assistant",
            content: [
              ...(text ? [{ type: "text", text }] : []),
              { type: "tool_use", id: call.id, name: call.name, input: parseJson(call.json) },
            ],
          });
          messages.push({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: call.id, content: "Applied. The GPT is updated." }],
          });
          body = await request();
        }
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("builder stream failed", err);
          emit({ type: "error", message: err instanceof UpstreamError ? err.message : "The reply was interrupted" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
