import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { MAX_FILE_BYTES, MAX_FILE_CHARS, fileKind } from "@/lib/files";

export class ExtractError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Plain text of an uploaded document (PDF, DOCX or text/code), capped at MAX_FILE_CHARS. */
export async function extractFileText(file: File): Promise<{ text: string; truncated: boolean }> {
  if (file.size > MAX_FILE_BYTES) throw new ExtractError("Files must be 4 MB or smaller", 413);

  const kind = fileKind(file.name, file.type);
  let text: string;
  try {
    if (kind === "pdf") {
      ({ text } = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true }));
    } else if (kind === "docx") {
      ({ value: text } = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) }));
    } else if (kind === "text") {
      text = await file.text();
    } else {
      throw new ExtractError("This file type isn't supported", 415);
    }
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    console.error("file extraction failed", file.name, err);
    throw new ExtractError("Couldn't read this file", 422);
  }

  text = text.trim();
  if (!text) throw new ExtractError("No readable text found in this file", 422);
  const truncated = text.length > MAX_FILE_CHARS;
  return { text: truncated ? text.slice(0, MAX_FILE_CHARS) : text, truncated };
}
