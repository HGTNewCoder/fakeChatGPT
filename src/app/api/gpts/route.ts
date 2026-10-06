import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Gpt, SHARED_FIELDS, toGptDto, toSharedGptDto, WITHOUT_KNOWLEDGE_TEXT } from "@/models/Gpt";
import { User } from "@/models/User";

const MAX_GPTS = 50;

/** For the sidebar: the user's created GPTs, plus other people's shared GPTs they have opened. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [own, me] = await Promise.all([
    Gpt.find({ owner: user.id, status: "published" }).select(WITHOUT_KNOWLEDGE_TEXT).sort({ updatedAt: -1 }).lean(),
    User.findById(user.id).select("sharedGpts").lean(),
  ]);
  // Only GPTs that are still shared; one made private again silently drops out.
  const shared = await Gpt.find({ _id: { $in: me?.sharedGpts ?? [] }, visibility: "link", status: "published" })
    .select(SHARED_FIELDS)
    .lean();
  const authors = await User.find({ _id: { $in: shared.map((g) => g.owner) } }).select("username").lean();
  const authorOf = new Map(authors.map((a) => [String(a._id), a.username]));

  return NextResponse.json({
    gpts: own.map(toGptDto),
    shared: shared.map((g) => toSharedGptDto(g, authorOf.get(String(g.owner)) ?? "unknown")),
  });
}

/** Opens the builder: resumes the user's untouched draft if there is one, otherwise starts a new one. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blank = { owner: user.id, status: "draft" as const, name: "", instructions: "", "knowledge.0": { $exists: false } };
  const existing = await Gpt.findOne(blank).select(WITHOUT_KNOWLEDGE_TEXT).lean();
  if (existing) return NextResponse.json({ gpt: toGptDto(existing) });

  if ((await Gpt.countDocuments({ owner: user.id })) >= MAX_GPTS) {
    return NextResponse.json({ error: `You can have up to ${MAX_GPTS} GPTs` }, { status: 400 });
  }
  const doc = await Gpt.create({ owner: user.id });
  return NextResponse.json({ gpt: toGptDto(doc.toObject()) }, { status: 201 });
}
