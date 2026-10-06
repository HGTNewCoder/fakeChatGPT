import { redirect } from "next/navigation";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { getCurrentUser } from "@/lib/auth";

// Holds chat state for every signed-in page, so it survives moving between chat and the GPT editor.
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ChatProvider user={user}>{children}</ChatProvider>;
}
