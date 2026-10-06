import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { firstIssue, registerSchema } from "@/lib/validation";
import { User } from "@/models/User";

const TAKEN = "That username is taken";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { username, password } = parsed.data;

  await connectDB();
  if (await User.exists({ username })) {
    return NextResponse.json({ error: TAKEN }, { status: 409 });
  }

  try {
    const user = await User.create({ username, passwordHash: await hashPassword(password) });
    await createSession(String(user._id));
  } catch (err) {
    // Unique index race: two signups with the same username at once.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: TAKEN }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
