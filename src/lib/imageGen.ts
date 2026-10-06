import "server-only";
import type { ImageSize } from "@/lib/validation";

const MODEL = "fal-ai/flux-2/klein/4b";
// Same model, but takes reference images to edit or draw from.
const EDIT_MODEL = `${MODEL}/edit`;
// fal accepts 4, but klein starts blending identities across references past 3.
export const MAX_REFERENCE_IMAGES = 3;
// fal bills per megapixel, not per step; 8 (the max) is a touch crisper than the default 4.
const STEPS = 8;

// ~1 MP for every aspect: klein looks best at 1024–1536 px per side, and fal's 4:3 presets
// are only 768 px on the short side. Both sides are multiples of 16.
const DIMENSIONS: Record<ImageSize, { width: number; height: number }> = {
  square_hd: { width: 1024, height: 1024 },
  portrait_4_3: { width: 896, height: 1152 },
  landscape_4_3: { width: 1152, height: 896 },
};

export type GeneratedImage = { url: string; width: number; height: number };

type FalResult = {
  images?: { url: string; width: number; height: number }[];
  has_nsfw_concepts?: boolean[];
};

export class ImageGenError extends Error {}

/**
 * Text-to-image, or image editing when `references` (http or data URLs) are given.
 * Throws ImageGenError with a user-facing message.
 */
export async function generateImage(
  {
    prompt,
    size,
    references = [],
    dimensions,
  }: {
    prompt: string;
    size: ImageSize;
    references?: string[];
    /** Overrides `size`, e.g. small square avatars. */
    dimensions?: { width: number; height: number };
  },
  signal?: AbortSignal,
): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new ImageGenError("FAL_KEY is not configured");
  const baseUrl = process.env.FAL_BASE_URL ?? "https://fal.run";
  const refs = references.slice(-MAX_REFERENCE_IMAGES);

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/${refs.length ? EDIT_MODEL : MODEL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
      body: JSON.stringify({
        prompt,
        image_size: dimensions ?? DIMENSIONS[size],
        ...(refs.length ? { image_urls: refs } : {}),
        num_inference_steps: STEPS,
        num_images: 1,
        output_format: "webp",
        enable_safety_checker: true,
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ImageGenError("Could not reach the image service");
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("fal error", upstream.status, detail);
    throw new ImageGenError(
      upstream.status === 422 && detail.includes("image_too_small")
        ? "Reference images must be at least 64×64 pixels."
        : `Image generation failed (${upstream.status})`,
    );
  }

  const data = (await upstream.json()) as FalResult;
  const image = data.images?.[0];
  if (!image) throw new ImageGenError("No image was returned");
  if (data.has_nsfw_concepts?.[0]) {
    throw new ImageGenError("This image was blocked by the safety filter. Try rephrasing your prompt.");
  }
  return { url: image.url, width: image.width, height: image.height };
}
