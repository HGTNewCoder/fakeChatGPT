// Built-in GPTs every user gets. This file holds only what the browser may see; their
// instructions live server-side in lib/builtinGpts.ts.

/** Circle avatar with an emoji, as an SVG data URL. */
function emojiAvatar(emoji: string, from: string, to: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<circle cx="32" cy="32" r="32" fill="url(#g)"/>` +
    `<text x="32" y="42" font-size="30" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type BuiltinGptCard = {
  id: string;
  name: string;
  description: string;
  starters: string[];
  avatar: string;
  capabilities: { webSearch: boolean; imageGeneration: boolean };
  author: string;
};

export const BUILTIN_GPT_CARDS: BuiltinGptCard[] = [
  {
    id: "builtin-escape-room",
    name: "Escape Room Giải Đố",
    description: "Vượt qua chuỗi 5 ổ khóa bằng câu đố logic, toán và mật mã mức trung bình cho học sinh lớp 7–9.",
    starters: [
      "Bắt đầu một escape room mới!",
      "Cho mình chuỗi câu đố toán học",
      "Mình muốn thử câu đố mật mã",
      "Luật chơi như thế nào?",
    ],
    avatar: emojiAvatar("🔐", "#f59e0b", "#b45309"),
    capabilities: { webSearch: false, imageGeneration: false },
    author: "ChadGPT",
  },
  {
    id: "builtin-socratic-tutor",
    name: "Gia sư Socratic",
    description: "Gia sư đặt câu hỏi gợi mở để bạn tự tìm ra lời giải, chỉ đưa đáp án khi bạn thật sự bí.",
    starters: [
      "Mình không hiểu cách giải phương trình bậc nhất",
      "Giúp mình hiểu vì sao có ngày và đêm",
      "Mình bị kẹt ở một bài toán phần trăm",
      "Làm sao để tìm ý chính của một đoạn văn?",
    ],
    avatar: emojiAvatar("🦉", "#6366f1", "#0ea5e9"),
    capabilities: { webSearch: false, imageGeneration: false },
    author: "ChadGPT",
  },
];

export const isBuiltinGptId = (id: string | undefined) => Boolean(id?.startsWith("builtin-"));
