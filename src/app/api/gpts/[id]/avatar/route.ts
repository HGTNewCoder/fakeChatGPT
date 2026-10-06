import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateImage, ImageGenError } from "@/lib/imageGen";
import { Gpt, toGptDto, WITHOUT_KNOWLEDGE_TEXT } from "@/models/Gpt";

export const maxDuration = 60;

/** Generates a profile picture from the GPT's name and description, like the builder's "Use DALL·E". */
export async function POST(req: Request, ctx: RouteContext<"/api/gpts/[id]/avatar">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = isValidObjectId(id)
    ? await Gpt.findOne({ _id: id, owner: user.id }).select(WITHOUT_KNOWLEDGE_TEXT)
    : null;
  if (!doc) return NextResponse.json({ error: "GPT not found" }, { status: 404 });

  // The editor may pass its unsaved name and description.
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; description?: unknown };
  const name = typeof body.name === "string" ? body.name.slice(0, 50) : doc.name;
  const description = typeof body.description === "string" ? body.description.slice(0, 300) : doc.description;
  const subject = [name, description].filter(Boolean).join(": ") || "a friendly general-purpose AI assistant";
  const prompt =
    `A bold, simple app icon representing ${subject}. One centered symbolic object or friendly mascot, ` +
    "flat vector illustration with soft gradients, thick clean shapes, two or three harmonious colors, " +
    "plain solid pastel background filling the frame, crisp edges, readable at small sizes.";

  try {
    const image = await generateImage({ prompt, size: "square_hd", dimensions: { width: 512, height: 512 } });
    // fal URLs expire, so keep the bytes.
    const res = await fetch(image.url);
    if (!res.ok) throw new ImageGenError("Couldn't download the generated image");
    const type = res.headers.get("content-type") ?? "image/webp";
    doc.avatar = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    await doc.save();
  } catch (err) {
    if (err instanceof ImageGenError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
  return NextResponse.json({ gpt: toGptDto(doc.toObject()) });
}
