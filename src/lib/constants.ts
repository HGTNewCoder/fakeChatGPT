import type { ImageSize } from "@/lib/validation";

export const APP_NAME = "ChadGPT";

/** Lowercase letters, digits, dots and underscores; no leading or trailing dot/underscore. */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

export const IMAGE_SIZE_OPTIONS: { id: ImageSize; label: string; aspect: string }[] = [
  { id: "square_hd", label: "Square", aspect: "aspect-square" },
  { id: "portrait_4_3", label: "Portrait", aspect: "aspect-[7/9]" },
  { id: "landscape_4_3", label: "Landscape", aspect: "aspect-[9/7]" },
];
