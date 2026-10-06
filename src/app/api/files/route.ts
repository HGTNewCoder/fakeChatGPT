import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ExtractError, extractFileText } from "@/lib/extract";

export const maxDuration = 60;

/** Extracts plain text from an uploaded document. Nothing is stored. */
export async function POST(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
  }

  try {
    return NextResponse.json(await extractFileText(file));
  } catch (err) {
    if (err instanceof ExtractError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
