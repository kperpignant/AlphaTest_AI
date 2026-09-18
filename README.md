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

1. Import the GitHub repo into Vercel.
2. Set Vercel env vars:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CONVEX_DEPLOY_KEY` (from the Convex dashboard)
3. Build uses Convex deploy + Vite:

```text
npx convex deploy --cmd "npm run build" --cmd-url-env-var-name VITE_CONVEX_URL
```

Local production-style build:

```bash
npm run deploy:vercel
```

4. On the Convex **production** deployment, set `CLERK_JWT_ISSUER_DOMAIN`.

Do **not** set a shared `OPENROUTER_API_KEY` for the app — users bring their own keys in Settings.

Optional model override:

```bash
npx convex env set OPENROUTER_MODEL openai/gpt-4o-mini
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
