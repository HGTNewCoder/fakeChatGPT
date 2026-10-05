# Murmur

A minimal AI chat app modeled on the layout of popular chat UIs: a collapsible sidebar, a centered
768px chat column and a docked composer. No third-party branding or assets.

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **MongoDB** (Mongoose) stores account credentials only (bcrypt-hashed passwords)
- **DeepSeek** API for replies, streamed token by token
- **FLUX.2 [klein] 4B** on [fal.ai](https://fal.ai/models/fal-ai/flux-2/klein/4b) for image generation (~$0.005 per 1024×1024 image)
- Chats live only in browser memory and are gone after a reload. Nothing is saved on the server.

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
    api/chat                    Auth-guarded DeepSeek proxy (SSE → plain text stream)
    api/image                   Auth-guarded fal.ai proxy (FLUX.2 [klein] 4B, returns image URL)
  components/chat               Sidebar, TopBar, Thread, Composer, Markdown, …
  hooks/useChat.ts              In-memory conversations, streaming text and image turns
  lib/                          db, auth (JWT cookie via jose), validation (zod), theme
  models/User.ts
```

## Image generation

Click the image button in the composer (or the **Image** chip) to switch to image mode, pick
Square / Portrait / Landscape, and describe the image. Image turns are shown inline and are not
included in the conversation history sent to DeepSeek. fal-hosted image URLs may expire, so
download anything you want to keep.

## Design system

| Token | Value |
|---|---|
| Spacing | 4px base (Tailwind scale). 16px mobile gutter / 24px desktop |
| Sidebar | 260px; 52px icon rail when collapsed (≥768px); off-canvas drawer below 768px |
| Chat column | `max-w-3xl` (768px), centered |
| Type | 12 (meta) · 14 (UI) · 16/28 (messages) · 18–24 (reply headings) · 28–32 (empty-state heading) |
| Radius | 8px rows · 16px menus/code · 24px bubbles · 28px composer |
| Color | Neutral grays as CSS variables in `globals.css`; light/dark follow the system or a manual choice |
