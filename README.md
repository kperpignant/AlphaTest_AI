# AlphaTest

Web SQA test case management — projects, suites, cases, runs, attachments, and BYOK AI assists.

Built as a greenfield rebuild of [AlphaTest](https://github.com/kperpignant/AlphaTest) on the same stack pattern as [NIDORA](https://github.com/kperpignant/NIDORA):

| Layer | Tech |
| --- | --- |
| Frontend | Vite + React (SPA on Vercel) |
| Auth | Clerk → Convex JWT |
| Backend | Convex |
| Case / failure AI | OpenRouter (per-user API key) |
| Similarity / RAG | OpenAI `text-embedding-3-small` (per-user, optional) |

---

## Features

- Shared **projects** with email membership invites
- **Suites** → **test cases** (type, priority, status, labels, assignee, page URL, browser notes)
- **Attachments** via Convex file storage
- **Test runs** with per-case results and status rollup
- **AI (BYOK)**
  - Case authoring from a prompt
  - Similar-case search (embeddings)
  - Failure assist (likely causes, next checks, bug-report draft)

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) application
- OpenRouter API key per teammate who will use AI authoring / failure assist
- Optional: OpenAI API key per teammate for similar-case search

### 1. Install and link Convex

```bash
npm install
npx convex dev
```

This creates a Convex project, writes `VITE_CONVEX_URL`, and regenerates `convex/_generated`.

### 2. Configure Clerk

1. Create a Clerk application and enable the **Convex** JWT template (see [Convex + Clerk](https://docs.convex.dev/auth/clerk)).
2. Set the issuer on Convex:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
```

3. Copy env example and fill in keys:

```bash
cp .env.local.example .env.local
# set VITE_CONVEX_URL and VITE_CLERK_PUBLISHABLE_KEY
```

### 3. Run locally

```bash
npm run dev
```

Sign in with Clerk, then open **Settings** to paste your OpenRouter key (and optional OpenAI key).

---

## Deploy (Vercel + Convex)

Vite embeds `VITE_*` vars **at build time**. A blank production page almost always means one of them was missing during the Vercel build.

### 1. Vercel environment variables

In the Vercel project → **Settings → Environment Variables**, set for **Production** (and Preview if you use it):

| Name | Value |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_…`). **Not** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. |
| `VITE_CONVEX_URL` | Your Convex deployment URL (e.g. `https://….convex.cloud` from the Convex dashboard / `.env.local`). |

Then **redeploy** so the new build picks them up.

### 2. Build command

`vercel.json` uses a plain Vite build (no Convex CLI during Vercel CI):

```text
npm run build
```

Push Convex functions separately from your machine (or CI with a deploy key):

```bash
npx convex deploy
```

Optional: to have Vercel run Convex deploy and inject `VITE_CONVEX_URL` automatically, set `CONVEX_DEPLOY_KEY` on Vercel and change the build command to:

```text
npx convex deploy --cmd "npm run build" --cmd-url-env-var-name VITE_CONVEX_URL
```

Without `CONVEX_DEPLOY_KEY`, that command fails with `MissingAccessToken`.

### 3. Convex auth for production

On the Convex deployment that `VITE_CONVEX_URL` points at:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-instance.clerk.accounts.dev
```

Do **not** set a shared `OPENROUTER_API_KEY` — users bring their own keys in Settings.

Optional model override:

```bash
npx convex env set OPENROUTER_MODEL openai/gpt-4o-mini
```

Local production-style build (requires Convex auth locally):

```bash
npm run deploy:vercel
```

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run deploy:vercel` | Convex deploy + Vite build |
| `npx convex dev` | Push Convex functions + regenerate types |

---

## AI (BYOK)

- Each user stores an OpenRouter key (and optional OpenAI key) on their user record.
- Client queries only receive `hasOpenRouterApiKey` / `hasOpenaiApiKey` — never raw secrets.
- Failure assist auto-runs when a result is marked failed **and** the executor has an OpenRouter key.
- Keys are visible to Convex deployment admins (hackathon BYOK tradeoff). Prefer revocable keys.

---
## License / provenance

Domain inspired by [kperpignant/AlphaTest](https://github.com/kperpignant/AlphaTest). Stack patterns adapted from [kperpignant/NIDORA](https://github.com/kperpignant/NIDORA).
