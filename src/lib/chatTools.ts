import type { ImageSize } from "@/lib/validation";

// System prompt and tool definitions for /api/chat (Anthropic Messages format, served by DeepSeek).

export const SYSTEM_PROMPT =
  "You are a helpful assistant. Answer clearly and concisely, in the language the user writes in. " +
  "Use Markdown for formatting when it helps. " +
  "Files the user attaches appear inside <file> tags in their message. " +
  "Use the web_search tool for anything that may have changed after your training data: news, prices, " +
  "weather, sports, releases, schedules, current office holders, or when the user asks you to look something " +
  "up. Search silently: don't announce that you are searching; just answer from the results, citing sources " +
  "inline as Markdown links. Don't search for things you already know reliably. " +
  "You can create and edit images with the generate_image tool. Use it whenever the user asks for a picture, " +
  "drawing, photo, illustration, logo, poster or a change to an image; don't describe the image in text instead. " +
  "Earlier images you made appear as [Generated image] notes. After calling the tool, don't repeat the prompt.";

const MAX_SEARCHES = 3;

export const ASPECTS: Record<string, ImageSize> = {
  square: "square_hd",
  portrait: "portrait_4_3",
  landscape: "landscape_4_3",
};

// DeepSeek runs this search on its own servers (Anthropic-style server tool); results come back in the stream.
export const SEARCH_TOOL = { type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES };

// Mirrors how ChatGPT/DALL·E 3 "upsample" a request: the chat model rewrites it into a rich prompt.
export const IMAGE_TOOL = {
  name: "generate_image",
  description:
    "Create a new image, or edit an existing one, with a text-to-image model. The model only sees `prompt`, " +
    "not the conversation, so the prompt must be self-contained.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        // Condensed from Black Forest Labs' FLUX.2 prompting guide. Klein has no prompt
        // upsampling of its own, so everything it needs has to be written out here.
        description:
          "English prompt for FLUX.2, written as flowing prose sentences (not comma-separated keywords), " +
          "40-100 words. Keep every detail the user asked for and fill in the rest. " +
          "ORDER MATTERS, the model weights early words most: main subject first, then action, then style, " +
          "then setting, then secondary details. Be concrete: 'a woman in her 30s with shoulder-length auburn " +
          "hair' not 'a person'; name materials and textures ('weathered teak', 'brushed aluminum'). " +
          "LIGHTING has the biggest impact: give source, quality, direction and color temperature " +
          "('soft overcast light from camera-left, cool 5600K'). Layer the scene: foreground, midground, background. " +
          "Photos: add camera, lens and aperture ('85mm f/1.8, shallow depth of field'). Other styles: name the " +
          "medium precisely ('watercolor on cold-press paper', 'flat vector illustration') and never mix " +
          "conflicting styles. Exact brand colors may be given as hex codes tied to an object ('a #1E90FF mug'). " +
          "TEXT IN THE IMAGE: only if the user asked; put it in double quotes exactly as written, keep it short, " +
          "and describe font style, color and placement. Describe only what should be visible: the model " +
          "ignores negatives, so write 'clean empty background' instead of 'no clutter'. Skip filler tags like " +
          "'8k, masterpiece, best quality'. EDITS: call the references 'image 1', 'image 2' in order, state the " +
          "change first, then list what must stay identical (pose, face, framing, colors, background). " +
          "Resolve 'it' or 'make it bluer' from the conversation. " +
          // Klein is a small model with little world knowledge: a bare name ("Hội An", "a Shiba Inu",
          // "Art Deco") often means nothing to it, so the prompt has to spell out what the thing looks like.
          "NAMES ARE NOT ENOUGH: the image model is small and doesn't know most named places, landmarks, " +
          "products, cultures, art styles, events or fictional settings. For every proper noun or niche term, " +
          "keep the name but also describe what it looks like: shape, architecture, materials, colors, clothing, " +
          "hairstyle, distinctive details, typical setting and era. Example: not just 'Hội An old town' but " +
          "'narrow streets lined with two-story mustard-yellow shophouses with dark timber balconies, terracotta " +
          "tile roofs and silk lanterns in red and gold strung overhead'. If you are not sure what something " +
          "looks like, or it may be recent, search the web first and describe it from what you find. " +
          "Copyrighted fictional characters (anime, comics, games, films): never put the character's name in the " +
          "prompt and never carry over their identifying traits: no signature hair color or style, face markings, " +
          "outfit and its colors, emblems, accessories or catchphrases. Instead design a clearly different original " +
          "character who fits the same genre, art style, mood and kind of scene (e.g. 'a young ninja in a " +
          "tournament arena, shonen anime style'), and choose new hair, clothing, colors and symbols for them. " +
          "Briefly tell the user that you made an original character inspired by the style.",
      },
      aspect_ratio: {
        type: "string",
        enum: Object.keys(ASPECTS),
        description: "square by default; portrait for people, posters, phone wallpapers; landscape for scenes.",
      },
      reference: {
        type: "string",
        enum: ["none", "last_generated", "attached"],
        description:
          "last_generated: edit or reuse the most recent image you made. attached: use the images the user " +
          "attached to their latest message. none: a brand-new image.",
      },
    },
    required: ["prompt", "aspect_ratio", "reference"],
  },
} as const;

// ---------- GPT Builder (the editor's Create tab) ----------

export const BUILDER_PROMPT =
  "You are the GPT Builder. You help the user create a custom GPT: a version of this assistant with its own " +
  "name, description, instructions and conversation starters. Talk to the user in the language they write in, " +
  "keep each message short and ask one question at a time.\n\n" +
  "How to work:\n" +
  "1. If the GPT is still empty, ask what they want to make. As soon as you understand the idea, call " +
  "update_gpt with a draft: a short memorable name, a one-sentence description, detailed instructions and " +
  "3-4 conversation starters. Then ask whether they like the name.\n" +
  "2. Then refine one aspect at a time: the GPT's role and goals, what it should and should not do, how it " +
  "asks for clarification, its tone and personality, output format. After each answer, call update_gpt with " +
  "the improved fields.\n" +
  "3. Offer to create a profile picture (set regenerate_avatar) once the name and purpose are clear.\n" +
  "4. When it is in good shape, tell them to try it in the Preview pane and press Create when ready.\n\n" +
  "Writing instructions: second person ('You are...'), concrete and complete, usually 150-600 words; cover " +
  "purpose, audience, behaviour, step-by-step workflow, style, formatting and limits. Write them in the " +
  "language the user is using. Always send the full replacement text for any field you change, never a diff. " +
  "The user can also edit fields directly in the Configure tab; the current configuration given below is " +
  "the source of truth.";

export const UPDATE_GPT_TOOL = {
  name: "update_gpt",
  description: "Update the GPT being built. Only include the fields you are changing.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short name, max 50 characters." },
      description: { type: "string", description: "One sentence shown under the name, max 300 characters." },
      instructions: { type: "string", description: "The full system instructions, max 8000 characters." },
      starters: {
        type: "array",
        items: { type: "string" },
        description: "Up to 4 example prompts shown to users, each under 200 characters.",
      },
      capabilities: {
        type: "object",
        properties: { webSearch: { type: "boolean" }, imageGeneration: { type: "boolean" } },
        description: "Turn web search or image generation on or off for this GPT.",
      },
      regenerate_avatar: {
        type: "boolean",
        description: "Generate a new profile picture from the name and description.",
      },
    },
  },
} as const;
