import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const knowledgeSchema = new Schema(
  {
    name: { type: String, required: true },
    size: { type: Number, required: true },
    text: { type: String, required: true },
    truncated: { type: Boolean, default: false },
  },
  { _id: true },
);

const gptSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Like ChatGPT's builder: a GPT starts as a draft and only shows in the sidebar once created.
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    // "link": anyone signed in with the share link can chat with it (like ChatGPT's "Anyone with the link").
    visibility: { type: String, enum: ["private", "link"], default: "private" },
    /** Unguessable id used in /g/<shareId>; created the first time the GPT is shared. */
    shareId: { type: String, unique: true, sparse: true },
    name: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    instructions: { type: String, default: "" },
    starters: { type: [String], default: [] },
    /** Small square image as a data URL (uploaded or generated), or empty for the initial-letter avatar. */
    avatar: { type: String, default: "" },
    capabilities: {
      webSearch: { type: Boolean, default: true },
      imageGeneration: { type: Boolean, default: true },
    },
    knowledge: { type: [knowledgeSchema], default: [] },
  },
  { timestamps: true },
);

export type GptDoc = InferSchemaType<typeof gptSchema>;

export const Gpt: Model<GptDoc> = models.Gpt ?? model<GptDoc>("Gpt", gptSchema);

export type GptCapabilities = { webSearch: boolean; imageGeneration: boolean };
export type KnowledgeMeta = { id: string; name: string; size: number; truncated: boolean };

/** Shape sent to the client. Knowledge text stays on the server. */
export type GptDto = {
  id: string;
  status: "draft" | "published";
  visibility: "private" | "link";
  shareId: string | null;
  name: string;
  description: string;
  instructions: string;
  starters: string[];
  avatar: string;
  capabilities: GptCapabilities;
  knowledge: KnowledgeMeta[];
};

type LeanGpt = Partial<GptDoc> & { _id: unknown; knowledge?: { _id?: unknown; name: string; size: number; truncated?: boolean | null }[] };

export function toGptDto(doc: LeanGpt): GptDto {
  return {
    id: String(doc._id),
    status: doc.status === "published" ? "published" : "draft",
    visibility: doc.visibility === "link" ? "link" : "private",
    shareId: doc.shareId ?? null,
    name: doc.name ?? "",
    description: doc.description ?? "",
    instructions: doc.instructions ?? "",
    starters: doc.starters ?? [],
    avatar: doc.avatar ?? "",
    capabilities: {
      webSearch: doc.capabilities?.webSearch ?? true,
      imageGeneration: doc.capabilities?.imageGeneration ?? true,
    },
    knowledge: (doc.knowledge ?? []).map((k) => ({
      id: String(k._id),
      name: k.name,
      size: k.size,
      truncated: Boolean(k.truncated),
    })),
  };
}

/** Never load knowledge text unless it's needed. */
export const WITHOUT_KNOWLEDGE_TEXT = "-knowledge.text";

/**
 * What someone else sees of a shared GPT: enough to show and start a chat, never its instructions
 * or knowledge.
 */
export type SharedGptDto = {
  id: string;
  shareId: string;
  name: string;
  description: string;
  starters: string[];
  avatar: string;
  capabilities: GptCapabilities;
  author: string;
};

export function toSharedGptDto(doc: LeanGpt, author: string): SharedGptDto {
  const full = toGptDto(doc);
  return {
    id: full.id,
    shareId: full.shareId ?? "",
    name: full.name,
    description: full.description,
    starters: full.starters,
    avatar: full.avatar,
    capabilities: full.capabilities,
    author,
  };
}

/** Fields safe to load for a shared view. */
export const SHARED_FIELDS = "owner shareId name description starters avatar capabilities";
