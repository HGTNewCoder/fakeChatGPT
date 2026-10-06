# ChadGPT

A minimal AI chat app modeled on the layout of popular chat UIs: a collapsible sidebar, a centered
768px chat column and a docked composer. No third-party branding or assets.

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **MongoDB** (Mongoose) stores accounts (username + bcrypt-hashed password, no email) and custom GPTs
- **DeepSeek** API (`deepseek-chat`, which also reads images) for replies, streamed token by token, via its
  Anthropic-compatible endpoint (`$DEEPSEEK_BASE_URL/anthropic/v1/messages`) so the model can use
  DeepSeek's built-in **web search** (sources shown under each reply); the current date and the user's time
  zone go into the system prompt
- **FLUX.2 [klein] 4B** on [fal.ai](https://fal.ai/models/fal-ai/flux-2/klein/4b) for image generation (~$0.005 per 1024×1024 image)
- Chats and attachments live only in browser memory and are gone after a reload.

Features are deliberately limited to four: chat, image generation, custom GPTs and file
attachments. The only setting is the Light / Dark theme in the account menu.

## Setup

```bash
cp .env.example .env.local      # then fill in DEEPSEEK_API_KEY, FAL_KEY and JWT_SECRET
docker compose up -d            # MongoDB 7 on localhost:27017
npm install
npm run dev                     # http://localhost:3000
```

Generate a session secret with `openssl rand -base64 32`.

## Structure

```
src/
  app/
    (auth)/login, register      Auth pages (redirect to / if already signed in)
    (chat)/page.tsx             Chat app (redirects to /login if signed out)
    api/auth/{register,login,logout}
    api/chat                    DeepSeek proxy (Anthropic SSE → NDJSON events): web_search + generate_image tools
    api/files                   Text extraction for PDF, DOCX and text files
    api/gpts, api/gpts/[id]     Custom GPTs: list, open draft, get/patch/delete (owner-scoped)
    api/gpts/[id]/knowledge     Knowledge file upload/remove; api/gpts/[id]/avatar generates a picture
    api/gpts/builder            GPT Builder conversation (update_gpt tool)
    api/g/[shareId]             Open a shared GPT (adds it to the sidebar) / remove it
    (chat)/g/[shareId]          Share link page
    (chat)/gpts/new, (chat)/gpts/editor/[id]   GPT editor pages
  components/chat               ChatProvider (layout state), Sidebar, TopBar, Thread, Composer, Markdown, …
  components/gpt-builder        GptBuilder (editor page), BuilderChat, ConfigureForm, Preview
  hooks/useChat.ts              In-memory conversations, attachments, streaming text and image turns
  hooks/useGpts.ts              The user's custom GPTs
  lib/                          db, auth (JWT cookie via jose), validation (zod), theme
  models/User.ts, models/Gpt.ts
```

## Custom GPTs

Modeled on ChatGPT's `/gpts/editor`. **Create a GPT** (`/gpts/new`) opens or resumes a draft at
`/gpts/editor/[id]`:

- **Create tab:** chat with the GPT Builder (`/api/gpts/builder`), which fills in the GPT through an
  `update_gpt` tool and can generate a profile picture.
- **Configure tab:** profile picture (upload, or generate with FLUX at 512 px, stored as a data URL),
  name, description, instructions, up to 4 conversation starters, **Knowledge** (up to 10 PDF/DOCX/text
  files; text extracted on upload and stored with the GPT) and **Capabilities** (web search, image
  generation).
- **Preview:** a live chat with the unsaved settings (sent as `gptDraft`); knowledge comes from the database.
- Drafts autosave and stay out of the sidebar until **Create**; a created GPT changes only on **Update**.

At chat time the GPT's instructions and knowledge are loaded on the server (never trusted from the
browser). Knowledge up to ~24k characters is sent whole; larger sets are chunked and the top excerpts
for the latest message are picked with BM25 keyword search (`lib/knowledge.ts`, MiniSearch). Chat state
lives in the `(chat)` layout, so in-memory chats survive a trip to the editor and back.

## Sharing GPTs

Like ChatGPT's "Anyone with the link". In the editor, **Share** switches a created GPT between
**Only me** and **Anyone with the link**, which gives it a random 12-character `shareId` and the link
`/g/<shareId>`. Opening the link (signed-in users only; `src/proxy.ts` sends others to
`/login?next=…`) adds the GPT to the visitor's sidebar and starts a chat. Visitors see the name,
description, picture and starters, never the instructions or knowledge, and their chats are
authorised by `shareId` on the server. Making the GPT private again cuts access immediately. Chats
with a shared GPT use the deployment's DeepSeek and fal.ai keys.

## Files

**+ → Add photos & files**, drag-and-drop or paste. Up to 10 attachments per message, 4 MB each (Vercel caps request bodies at 4.5 MB).

- **Images** (PNG, JPEG, WebP, GIF, max 4): downscaled in the browser and sent to DeepSeek's vision input.
- **PDF / DOCX / text & code files**: `/api/files` extracts the text (`unpdf`, `mammoth`), keeps up to
  100k characters and returns it. Nothing is stored. The text is sent to the model inside `<file>` tags.

## Image generation

Modeled on how ChatGPT and Gemini wrap their image models, generation goes through the chat model
instead of sending the user's words straight to FLUX:

1. **Tool call.** `/api/chat` gives DeepSeek a `generate_image` tool. Asking for a picture in a normal
   chat ("vẽ cho mình con mèo…") is enough; the model decides to call it. Image mode
   (**+ → Create image**) forces the call with `tool_choice` and fixes the aspect ratio.
2. **Prompt rewriting.** The tool's `prompt` argument must be a self-contained, detailed English
   prompt (subject, composition, style, lighting, quoted text kept verbatim), the same idea as
   DALL·E 3's `revised_prompt`. Follow-ups like "make it bluer" are resolved from the conversation.
   The rewritten prompt is shown under each image (**Show prompt**).
3. **Editing.** The model picks `reference`: `last_generated` (the previous image) or `attached`
   (images on the user's message). With references, `lib/imageGen.ts` calls
   `fal-ai/flux-2/klein/4b/edit` instead of the text-to-image endpoint.

Because klein knows few named things, the rewriter must also turn proper nouns (places, products, styles,
events) into visual descriptions, searching the web first when unsure. Copyrighted characters are replaced
with an original character in the same genre and style. Prompt rules live in `lib/chatTools.ts`. In image
mode the tool call is forced, so no search happens before the prompt is written.

Generation settings (`lib/imageGen.ts`): 8 steps (fal's max; billing is per megapixel, not per step),
~1 MP for every aspect (1024², 896×1152, 1152×896) and at most 3 reference images, since klein starts
mixing identities beyond that. The tool's prompt rules are condensed from Black Forest Labs' FLUX.2
prompting guide: subject first, prose over keywords, explicit lighting, positive phrasing only.

The stream carries `text`, `search`, `sources`, `image_start`, `image` and `error` events (NDJSON). fal-hosted image URLs
may expire, so download anything you want to keep.

## Design system

| Token | Value |
|---|---|
| Spacing | 4px base (Tailwind scale). 16px mobile gutter / 24px desktop |
| Sidebar | 260px; 52px icon rail when collapsed (≥768px); off-canvas drawer below 768px |
| Chat column | `max-w-3xl` (768px), centered |
| Type | 12 (meta) · 14 (UI) · 16/28 (messages) · 18–24 (reply headings) · 28–32 (empty-state heading) |
| Radius | 8px rows · 16px menus/code · 24px bubbles · 28px composer |
| Color | Neutral grays as CSS variables in `globals.css`; light/dark follow the system until the user picks one |
