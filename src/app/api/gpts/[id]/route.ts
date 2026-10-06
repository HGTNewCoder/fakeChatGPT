import { randomBytes } from "node:crypto";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { firstIssue, gptUpdateSchema } from "@/lib/validation";
import { Gpt, toGptDto, WITHOUT_KNOWLEDGE_TEXT } from "@/models/Gpt";
import { User } from "@/models/User";

const notFound = () => NextResponse.json({ error: "GPT not found" }, { status: 404 });

export async function GET(_req: Request, ctx: RouteContext<"/api/gpts/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound();
  const doc = await Gpt.findOne({ _id: id, owner: user.id }).select(WITHOUT_KNOWLEDGE_TEXT).lean();
  return doc ? NextResponse.json({ gpt: toGptDto(doc) }) : notFound();
}

/** Autosave (drafts), Update (published GPTs) and Create (`publish: true`). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/gpts/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound();

  const parsed = gptUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { publish, ...fields } = parsed.data;

  const doc = await Gpt.findOne({ _id: id, owner: user.id }).select(WITHOUT_KNOWLEDGE_TEXT);
  if (!doc) return notFound();
  doc.set(fields);

  if (publish || doc.status === "published") {
    if (!doc.name) return NextResponse.json({ error: "Give your GPT a name" }, { status: 400 });
    if (!doc.instructions) return NextResponse.json({ error: "Add instructions for your GPT" }, { status: 400 });
    doc.status = "published";
  }
  if (doc.visibility === "link") {
    if (doc.status !== "published") {
      return NextResponse.json({ error: "Create the GPT before sharing it" }, { status: 400 });
    }
    // 9 random bytes → 12 URL-safe characters; kept if the GPT is made private and shared again.
    doc.shareId ??= randomBytes(9).toString("base64url");
  }
  await doc.save();
  return NextResponse.json({ gpt: toGptDto(doc.toObject()) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/gpts/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound();

  const { deletedCount } = await Gpt.deleteOne({ _id: id, owner: user.id });
  if (!deletedCount) return notFound();
  // Drop it from the sidebars of people it was shared with.
  await User.updateMany({ sharedGpts: id }, { $pull: { sharedGpts: id } });
  return new Response(null, { status: 204 });
}
