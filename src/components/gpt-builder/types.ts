import type { Gpt } from "@/hooks/useGpts";

/** The editable part of a GPT, as held by the editor. */
export type EditorConfig = Pick<Gpt, "name" | "description" | "instructions" | "starters" | "capabilities" | "avatar">;

export function configOf(gpt: Gpt): EditorConfig {
  return {
    name: gpt.name,
    description: gpt.description,
    instructions: gpt.instructions,
    starters: gpt.starters,
    capabilities: gpt.capabilities,
    avatar: gpt.avatar,
  };
}

/** What the GPT Builder sends back when it edits the GPT. */
export type BuilderPatch = Partial<Omit<EditorConfig, "avatar" | "capabilities">> & {
  capabilities?: Partial<EditorConfig["capabilities"]>;
  regenerate_avatar?: boolean;
};
