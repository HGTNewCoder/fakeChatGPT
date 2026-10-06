import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ExtractError, extractFileText } from "@/lib/extract";
import { MAX_KNOWLEDGE_FILES } from "@/lib/validation";
import { Gpt, toGptDto, WITHOUT_KNOWLEDGE_TEXT } from "@/models/Gpt";

export const maxDuration = 60;

/** Adds one knowledge file: its text is extracted now and stored with the GPT. */
export async function POST(req: Request, ctx: RouteContext<"/api/gpts/[id]/knowledge">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return NextResponse.json({ error: "GPT not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
  }

  let extracted: { text: string; truncated: boolean };
  try {
    extracted = await extractFileText(file);
  } catch (err) {
    if (err instanceof ExtractError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  // The size check is part of the filter, so two uploads at once can't exceed the limit.
  const doc = await Gpt.findOneAndUpdate(
    { _id: id, owner: user.id, [`knowledge.${MAX_KNOWLEDGE_FILES - 1}`]: { $exists: false } },
    { $push: { knowledge: { name: file.name, size: file.size, ...extracted } } },
    { new: true, projection: WITHOUT_KNOWLEDGE_TEXT },
  ).lean();
  if (!doc) {
    const exists = await Gpt.exists({ _id: id, owner: user.id });
    return exists
      ? NextResponse.json({ error: `A GPT can have up to ${MAX_KNOWLEDGE_FILES} knowledge files` }, { status: 400 })
      : NextResponse.json({ error: "GPT not found" }, { status: 404 });
  }
  return NextResponse.json({ gpt: toGptDto(doc) }, { status: 201 });
}
