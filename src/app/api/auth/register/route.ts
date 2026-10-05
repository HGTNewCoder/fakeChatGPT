import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { firstIssue, registerSchema } from "@/lib/validation";
import { User } from "@/models/User";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  await connectDB();
  if (await User.exists({ email: email.toLowerCase() })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  try {
    const user = await User.create({ name, email, passwordHash: await hashPassword(password) });
    await createSession(String(user._id));
  } catch (err) {
    // Unique index race: two signups with the same email at once.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
