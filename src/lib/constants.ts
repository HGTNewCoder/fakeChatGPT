import type { ImageSize, ModelId } from "@/lib/validation";

export const APP_NAME = "Murmur";

export const MODEL_OPTIONS: { id: ModelId; label: string; description: string }[] = [
  { id: "deepseek-chat", label: "DeepSeek Chat", description: "Fast, general-purpose replies" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner", description: "Thinks longer before answering" },
];

export const IMAGE_SIZE_OPTIONS: { id: ImageSize; label: string; aspect: string }[] = [
  { id: "square_hd", label: "Square", aspect: "aspect-square" },
  { id: "portrait_4_3", label: "Portrait", aspect: "aspect-[3/4]" },
  { id: "landscape_4_3", label: "Landscape", aspect: "aspect-[4/3]" },
];
