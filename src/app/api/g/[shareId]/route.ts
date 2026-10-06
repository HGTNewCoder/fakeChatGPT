import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { SHARE_ID_PATTERN } from "@/lib/validation";
import { Gpt, SHARED_FIELDS, toSharedGptDto } from "@/models/Gpt";
import { User } from "@/models/User";

const notFound = () =>
  NextResponse.json({ error: "This GPT doesn't exist or is no longer shared" }, { status: 404 });

async function findShared(shareId: string) {
  if (!SHARE_ID_PATTERN.test(shareId)) return null;
  return Gpt.findOne({ shareId, visibility: "link", status: "published" }).select(SHARED_FIELDS).lean();
}

/**
 * Opens a shared GPT from its link: returns what the visitor may see (never instructions or
 * knowledge) and adds it to their sidebar. `own` tells the owner it's their GPT.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/g/[shareId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gpt = await findShared((await ctx.params).shareId);
  if (!gpt) return notFound();

  const own = String(gpt.owner) === user.id;
  if (!own) await User.updateOne({ _id: user.id }, { $addToSet: { sharedGpts: gpt._id } });
  const author = own ? user.username : ((await User.findById(gpt.owner).select("username").lean())?.username ?? "unknown");
  return NextResponse.json({ gpt: toSharedGptDto(gpt, author), own });
}

/** Removes a shared GPT from the visitor's sidebar. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/g/[shareId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shareId } = await ctx.params;
  if (!SHARE_ID_PATTERN.test(shareId)) return notFound();
  const gpt = await Gpt.findOne({ shareId }).select("_id").lean();
  if (gpt) await User.updateOne({ _id: user.id }, { $pull: { sharedGpts: gpt._id } });
  return new Response(null, { status: 204 });
}
