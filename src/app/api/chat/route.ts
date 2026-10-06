import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deepseekMessages, parseJson, readEvents, UpstreamError } from "@/lib/anthropic";
import { isBuiltinGptId } from "@/lib/builtinGptCards";
import { getBuiltinGpt } from "@/lib/builtinGpts";
import { ASPECTS, IMAGE_TOOL, SEARCH_TOOL, SYSTEM_PROMPT } from "@/lib/chatTools";
import { generateImage, ImageGenError } from "@/lib/imageGen";
import { knowledgeContext } from "@/lib/knowledge";
import { chatSchema, firstIssue } from "@/lib/validation";
import { Gpt } from "@/models/Gpt";

// Leaves room for web searches, a reply and an image generation.
export const maxDuration = 120;

type ToolArgs = { prompt?: string; aspect_ratio?: string; reference?: string };
type Source = { title: string; url: string };

// The model has no clock; without this it can't tell what "today" or "latest" means.
function currentDate(timeZone?: string) {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date());
  try {
    return `${format(timeZone ?? "UTC")} (${timeZone ?? "UTC"})`;
  } catch {
    return `${format("UTC")} (UTC)`;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = chatSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { gptId, shareId, timeZone, messages: history } = parsed.data;

  let system = `${SYSTEM_PROMPT}\n\nCurrent date and time: ${currentDate(timeZone)}.`;
  let capabilities = { webSearch: true, imageGeneration: true };

  // A custom GPT's instructions and knowledge are loaded here, never trusted from the client.
  // Your own GPTs load by id; anyone else's only through a live share link. Only the owner's
  // editor Preview may override the text fields with unsaved edits.
  const fields = "name instructions capabilities knowledge";
  let gpt = null;
  let gptDraft = undefined;
  if (shareId) {
    gpt = await Gpt.findOne({ shareId, visibility: "link", status: "published" }).select(fields).lean();
    if (!gpt) return NextResponse.json({ error: "This GPT is no longer shared" }, { status: 404 });
  } else if (isBuiltinGptId(gptId)) {
    // Built-in GPTs ship with the app: same for everyone, no knowledge, no editor drafts.
    const builtin = getBuiltinGpt(gptId!);
    if (!builtin) return NextResponse.json({ error: "This GPT no longer exists" }, { status: 404 });
    gpt = { name: builtin.name, instructions: builtin.instructions, capabilities: builtin.capabilities, knowledge: [] };
  } else if (gptId) {
    gpt = isValidObjectId(gptId) ? await Gpt.findOne({ _id: gptId, owner: user.id }).select(fields).lean() : null;
    if (!gpt) return NextResponse.json({ error: "This GPT no longer exists" }, { status: 404 });
    gptDraft = parsed.data.gptDraft;
  }
  if (gpt) {
    const name = gptDraft?.name ?? gpt.name;
    const instructions = gptDraft?.instructions ?? gpt.instructions;
    capabilities = gptDraft?.capabilities ?? {
      webSearch: gpt.capabilities?.webSearch ?? true,
      imageGeneration: gpt.capabilities?.imageGeneration ?? true,
    };
    system += `\n\nYou are "${name || "Untitled GPT"}", a custom GPT.`;
    if (instructions) system += ` Follow these instructions from its creator:\n\n${instructions}`;

    const lastUser = history.findLast((m) => m.role === "user")?.content ?? "";
    const knowledge = knowledgeContext(gpt.knowledge ?? [], lastUser);
    if (knowledge) system += `\n\n${knowledge}`;
  }
  if (!capabilities.webSearch) system += "\n\nWeb search is turned off for this GPT.";
  if (!capabilities.imageGeneration) system += "\n\nImage generation is turned off for this GPT; say so if asked.";

  const tools = [
    ...(capabilities.webSearch ? [SEARCH_TOOL] : []),
    ...(capabilities.imageGeneration ? [IMAGE_TOOL] : []),
  ];
  const imageSize = capabilities.imageGeneration ? parsed.data.imageSize : undefined;

  // Anthropic message format: images as base64 blocks, generated images as text notes.
  const messages = history.map(({ role, content, images, generated }) => {
    const text = generated
      ? [content, `[Generated image] prompt: ${generated.prompt}`].filter(Boolean).join("\n\n")
      : content;
    const blocks = (images ?? []).map((url) => {
      const [, mediaType, data] = url.match(/^data:(image\/[a-z]+);base64,(.*)$/)!;
      return { type: "image", source: { type: "base64", media_type: mediaType, data } };
    });
    return { role, content: [...blocks, { type: "text", text: text || "(no text)" }] };
  });

  let body: ReadableStream<Uint8Array>;
  try {
    body = await deepseekMessages(
      {
        system,
        messages,
        ...(tools.length ? { tools } : {}),
        // Image mode: skip the decision and always produce an image.
        ...(imageSize ? { tool_choice: { type: "tool", name: "generate_image" } } : {}),
      },
      req.signal,
    );
  } catch (err) {
    if (err instanceof UpstreamError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const encoder = new TextEncoder();

  // NDJSON events for the client: text deltas, searches and their sources, then optionally an image.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const blocks = new Map<number, { type: string; name?: string; json: string }>();
        let wroteText = false;
        let imageArgs: ToolArgs | null = null;

        for await (const event of readEvents(body)) {
          if (event.type === "content_block_start") {
            const block = event.content_block;
            blocks.set(event.index, { type: block.type, name: block.name, json: "" });
            if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
              const sources: Source[] = block.content
                .filter((r: { type?: string; url?: string }) => r.type === "web_search_result" && r.url)
                .map((r: Source) => ({ title: r.title || r.url, url: r.url }));
              if (sources.length) emit({ type: "sources", sources });
            }
            // Keep separate text blocks (before and after a search) from running together.
            if (block.type === "text" && wroteText) emit({ type: "text", text: "\n\n" });
          } else if (event.type === "content_block_delta") {
            const block = blocks.get(event.index);
            if (event.delta.type === "text_delta" && event.delta.text) {
              emit({ type: "text", text: event.delta.text });
              wroteText = true;
            } else if (event.delta.type === "input_json_delta" && block) {
              block.json += event.delta.partial_json ?? "";
            }
          } else if (event.type === "content_block_stop") {
            const block = blocks.get(event.index);
            if (block?.type === "server_tool_use" && block.name === "web_search") {
              emit({ type: "search", query: parseJson<{ query?: string }>(block.json).query ?? "" });
            } else if (block?.type === "tool_use" && block.name === "generate_image") {
              imageArgs = parseJson<ToolArgs>(block.json);
            }
          } else if (event.type === "error") {
            throw new Error(event.error?.message ?? "DeepSeek stream error");
          }
        }

        if (imageArgs) {
          const lastUser = history.findLast((m) => m.role === "user");
          const prompt = imageArgs.prompt?.trim() || lastUser?.content || "";
          const size = imageSize ?? ASPECTS[imageArgs.aspect_ratio ?? ""] ?? "square_hd";
          const references =
            imageArgs.reference === "last_generated"
              ? [history.findLast((m) => m.generated)?.generated?.url].filter((u): u is string => !!u)
              : imageArgs.reference === "attached"
                ? (lastUser?.images ?? [])
                : [];

          emit({ type: "image_start", prompt, size, edit: references.length > 0 });
          const image = await generateImage({ prompt, size, references }, req.signal);
          emit({ type: "image", prompt, size, ...image });
        }
      } catch (err) {
        if (!req.signal.aborted) {
          if (!(err instanceof ImageGenError)) console.error("chat stream failed", err);
          emit({ type: "error", message: err instanceof ImageGenError ? err.message : "The reply was interrupted" });
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
