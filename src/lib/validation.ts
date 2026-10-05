import { z } from "zod";

export const MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;
export type ModelId = (typeof MODELS)[number];

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(128),
});

export const chatSchema = z.object({
  model: z.enum(MODELS).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(32_000),
      }),
    )
    .min(1)
    .max(100),
});

export const IMAGE_SIZES = ["square_hd", "portrait_4_3", "landscape_4_3"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const imageSchema = z.object({
  prompt: z.string().trim().min(1, "Describe the image you want").max(2000),
  size: z.enum(IMAGE_SIZES).default("square_hd"),
});

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request";
}
