import { GptBuilder } from "@/components/gpt-builder/GptBuilder";

export const metadata = { title: "Edit GPT" };

export default async function GptEditorPage({ params }: PageProps<"/gpts/editor/[id]">) {
  const { id } = await params;
  return <GptBuilder id={id} />;
}
