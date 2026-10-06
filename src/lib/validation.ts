import { z } from "zod";
import { USERNAME_PATTERN } from "@/lib/constants";

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(USERNAME_PATTERN, "Use letters, numbers, dots or underscores (no spaces)");

export const registerSchema = z
  .object({
    username,
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Username is required").max(32),
  password: z.string().min(1, "Password is required").max(128),
});

export const MAX_IMAGES_PER_MESSAGE = 4;

// Images arrive as data URLs that the client has already downscaled.
const imageDataUrl = z
  .string()
  .max(8_000_000, "Image is too large")
  .regex(/^data:image\/(png|jpeg|webp|gif);base64,/, "Unsupported image");

export const IMAGE_SIZES = ["square_hd", "portrait_4_3", "landscape_4_3"] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

const capabilities = z.object({ webSearch: z.boolean(), imageGeneration: z.boolean() });

/** Unsaved editor state the Preview pane chats with. Knowledge still comes from the database. */
export const gptDraftSchema = z.object({
  name: z.string().max(50),
  description: z.string().max(300),
  instructions: z.string().max(8000),
  capabilities,
});

export type GptDraft = z.infer<typeof gptDraftSchema>;

export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;

export const chatSchema = z.object({
  gptId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  /** Someone else's GPT, used through its share link. */
  shareId: z.string().regex(SHARE_ID_PATTERN).optional(),
  /** Set by image mode: always create an image, in this size. */
  imageSize: z.enum(IMAGE_SIZES).optional(),
  /** Editor preview: overrides the saved GPT's settings. */
  gptDraft: gptDraftSchema.optional(),
  /** The browser's IANA time zone, so the model knows the user's local date. */
  timeZone: z.string().max(64).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Includes the text of any attached documents.
        content: z.string().max(600_000),
        images: z.array(imageDataUrl).max(MAX_IMAGES_PER_MESSAGE).optional(),
        /** An image the assistant generated earlier, so it can be referenced or edited. */
        generated: z.object({ prompt: z.string().max(4000), url: z.url() }).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const MAX_STARTERS = 4;
export const MAX_KNOWLEDGE_FILES = 10;

/** Every field is optional so drafts can autosave half-finished. */
export const gptUpdateSchema = z.object({
  name: z.string().trim().max(50).optional(),
  description: z.string().trim().max(300).optional(),
  instructions: z.string().trim().max(8000).optional(),
  starters: z
    .array(z.string().trim().max(200))
    .max(MAX_STARTERS)
    .transform((list) => list.filter(Boolean))
    .optional(),
  avatar: z
    .union([z.literal(""), z.string().max(300_000).regex(/^data:image\/(png|jpeg|webp);base64,/, "Unsupported image")])
    .optional(),
  capabilities: capabilities.optional(),
  visibility: z.enum(["private", "link"]).optional(),
  /** Draft → published ("Create"). */
  publish: z.boolean().optional(),
});
export type GptUpdate = z.input<typeof gptUpdateSchema>;

/** The Create tab's conversation with the GPT Builder. */
export const builderSchema = z.object({
  config: z.object({
    name: z.string().max(50),
    description: z.string().max(300),
    instructions: z.string().max(8000),
    starters: z.array(z.string().max(200)).max(MAX_STARTERS),
    capabilities,
  }),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) }))
    .min(1)
    .max(60),
  timeZone: z.string().max(64).optional(),
});

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request";
}
