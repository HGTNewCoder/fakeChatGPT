import { MAX_IMAGES_PER_MESSAGE } from "@/lib/validation";

// Vercel Functions reject request bodies over 4.5 MB.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Characters of extracted text kept per document (~25k tokens). */
export const MAX_FILE_CHARS = 100_000;
export const MAX_ATTACHMENTS = 10;
export { MAX_IMAGES_PER_MESSAGE };

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "xml", "yaml", "yml", "toml", "ini", "log",
  "html", "htm", "css", "scss", "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "rb", "go", "rs", "java",
  "kt", "swift", "c", "h", "cpp", "hpp", "cc", "cs", "php", "sh", "bash", "ps1", "sql", "r", "lua",
  "dart", "vue", "svelte", "tex", "env", "gitignore", "dockerfile",
]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type FileKind = "image" | "pdf" | "docx" | "text" | "unsupported";

export function fileKind(name: string, type: string): FileKind {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : name.toLowerCase();
  if (IMAGE_TYPES.has(type)) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (type.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  return "unsupported";
}

/** Value for the file picker's `accept` attribute. */
export const ACCEPT = [
  ...IMAGE_TYPES,
  ".pdf",
  ".docx",
  ...[...TEXT_EXTENSIONS].map((e) => `.${e}`),
].join(",");

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_IMAGE_SIDE = 1568;

/** Browser only: downscales an image and returns it as a data URL. */
export async function imageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    // Small images are sent untouched to keep transparency and detail; the rest are
    // re-encoded so several fit in one request.
    if (scale === 1 && file.size < 300_000) return await readAsDataUrl(file);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    bitmap.close();
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Browser only: center-crops an image to a 256px square WebP data URL for a GPT avatar. */
export async function imageToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    canvas
      .getContext("2d")!
      .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    return canvas.toDataURL("image/webp", 0.9);
  } finally {
    bitmap.close();
  }
}
