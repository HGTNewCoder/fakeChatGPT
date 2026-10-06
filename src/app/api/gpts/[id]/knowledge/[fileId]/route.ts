import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Gpt, toGptDto, WITHOUT_KNOWLEDGE_TEXT } from "@/models/Gpt";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/gpts/[id]/knowledge/[fileId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, fileId } = await ctx.params;
  if (!isValidObjectId(id) || !isValidObjectId(fileId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await Gpt.findOneAndUpdate(
    { _id: id, owner: user.id },
    { $pull: { knowledge: { _id: fileId } } },
    { new: true, projection: WITHOUT_KNOWLEDGE_TEXT },
  ).lean();
  if (!doc) return NextResponse.json({ error: "GPT not found" }, { status: 404 });
  return NextResponse.json({ gpt: toGptDto(doc) });
}
