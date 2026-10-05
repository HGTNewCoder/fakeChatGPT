import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { firstIssue, loginSchema } from "@/lib/validation";
import { User } from "@/models/User";

// Compared against when the email is unknown so both failure paths take similar time.
const DUMMY_HASH = "$2b$12$AHlg/K2Nz1I7uJPmRI2veu.k8wFilYZdrpdSibfQ6263Em/x1LEgu";

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() }).select("passwordHash").lean();
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(String(user._id));
  return NextResponse.json({ ok: true });
}
