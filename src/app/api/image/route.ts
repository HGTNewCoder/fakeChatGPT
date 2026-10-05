import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { firstIssue, imageSchema } from "@/lib/validation";

export const maxDuration = 60;

const MODEL = "fal-ai/flux-2/klein/4b";

type FalResult = {
  images?: { url: string; width: number; height: number }[];
  has_nsfw_concepts?: boolean[];
};

export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = imageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FAL_KEY is not configured" }, { status: 500 });
  }
  const baseUrl = process.env.FAL_BASE_URL ?? "https://fal.run";

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/${MODEL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
      body: JSON.stringify({
        prompt: parsed.data.prompt,
        image_size: parsed.data.size,
        num_images: 1,
        output_format: "webp",
        enable_safety_checker: true,
      }),
      signal: req.signal,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the image service" }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("fal error", upstream.status, detail);
    return NextResponse.json(
      { error: `Image generation failed (${upstream.status})` },
      { status: upstream.status === 422 ? 400 : 502 },
    );
  }

  const data = (await upstream.json()) as FalResult;
  const image = data.images?.[0];
  if (!image) {
    return NextResponse.json({ error: "No image was returned" }, { status: 502 });
  }
  if (data.has_nsfw_concepts?.[0]) {
    return NextResponse.json(
      { error: "This image was blocked by the safety filter. Try rephrasing your prompt." },
      { status: 422 },
    );
  }

  return NextResponse.json({ url: image.url, width: image.width, height: image.height });
}
