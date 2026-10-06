import "server-only";
import MiniSearch from "minisearch";

export type KnowledgeFile = { name: string; text: string };

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 200;
/** Small knowledge bases are sent whole; retrieval only kicks in above this. */
const INLINE_LIMIT = 24_000;
const TOP_K = 6;

type Chunk = { id: number; file: string; text: string };

// Splits on paragraph boundaries where possible so chunks stay readable.
function chunk(file: KnowledgeFile, startId: number): Chunk[] {
  const chunks: Chunk[] = [];
  let pos = 0;
  while (pos < file.text.length) {
    let end = Math.min(pos + CHUNK_CHARS, file.text.length);
    if (end < file.text.length) {
      const para = file.text.lastIndexOf("\n", end);
      if (para > pos + CHUNK_CHARS / 2) end = para;
    }
    chunks.push({ id: startId + chunks.length, file: file.name, text: file.text.slice(pos, end).trim() });
    if (end >= file.text.length) break;
    pos = Math.max(end - CHUNK_OVERLAP, pos + 1);
  }
  return chunks.filter((c) => c.text);
}

/**
 * Knowledge excerpts relevant to `query`, formatted for the system prompt. Custom GPTs in ChatGPT
 * retrieve from their files rather than reading them whole; this does the same with BM25 keyword
 * search (MiniSearch), which needs no embedding API.
 */
export function knowledgeContext(files: KnowledgeFile[], query: string): string {
  if (!files.length) return "";
  const total = files.reduce((n, f) => n + f.text.length, 0);

  let excerpts: { file: string; text: string }[];
  if (total <= INLINE_LIMIT) {
    excerpts = files.map((f) => ({ file: f.name, text: f.text }));
  } else {
    const chunks = files.flatMap((f, i) => chunk(f, i * 100_000));
    const index = new MiniSearch<Chunk>({ fields: ["text", "file"], storeFields: ["file", "text"] });
    index.addAll(chunks);
    const hits = index.search(query, { prefix: true, fuzzy: 0.15, boost: { file: 0.5 } }).slice(0, TOP_K);
    // No keyword overlap (e.g. "summarize this"): fall back to each file's opening.
    excerpts = hits.length
      ? hits.map((h) => ({ file: h.file as string, text: h.text as string }))
      : files.map((f) => ({ file: f.name, text: f.text.slice(0, INLINE_LIMIT / files.length) }));
  }

  const body = excerpts.map((e) => `<excerpt file="${e.file}">\n${e.text}\n</excerpt>`).join("\n\n");
  return (
    `Knowledge files: ${files.map((f) => f.name).join(", ")}.\n` +
    `Relevant excerpts from them are below. Prefer them over general knowledge for questions they cover, ` +
    `and say so when they don't contain the answer.\n\n${body}`
  );
}
