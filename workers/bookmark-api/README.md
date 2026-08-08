# Bookmark API

A REST API built on [Cloudflare Workers](https://developers.cloudflare.com/workers/) that stores bookmarks in **D1** (SQL), serves fast reads via a **KV cache**, and auto-generates one-sentence summaries with **Workers AI** routed through **AI Gateway**.

> Built by following the hands-on workshop **"Build a Bookmark API with Cloudflare Workers"** at <https://labs.cloudflare.dev/workers/>. This repo is currently at **Step 6 (AI Gateway)** of 7 — the only remaining step is deploying to production.

## Features

- **CRUD endpoints** — create, list, get, delete bookmarks (`src/index.ts` routing without frameworks)
- **D1 (SQLite) as source of truth** — relational queries, tag filtering with `LIKE`, `ORDER BY created_at`
- **KV cache-aside** — reads check KV first (with `_cached: true` marker), D1 fallback; writes go D1 → KV
- **Workers AI auto-summary** — `@cf/meta/llama-3.1-8b-instruct-fast` generates a one-sentence summary per bookmark; fails gracefully (bookmark still saves if AI errors)
- **AI Gateway** — summaries routed through `bookmark-gateway` with 24h cache (`cacheTtl: 86400`)

## Tech Stack

| Tool | Role |
|------|------|
| Wrangler | CLI for dev, deploy, and resource management |
| Workers KV (`BOOKMARKS`) | Read cache |
| D1 (`DB` / `bookmark-db`) | Source of truth, SQL queries |
| Workers AI (`AI`) | Summary generation |
| AI Gateway | Caching, analytics, rate limiting for AI calls |

## Prerequisites

- Node.js v20+
- Cloudflare account (authenticate with `npx wrangler login`)

## Setup

```bash
npm install

# Apply the D1 schema (bookmarks table) and the summary-column migration
npx wrangler d1 execute bookmark-db --local --file=./schema.sql
npx wrangler d1 execute bookmark-db --local --file=./migration-summary.sql

# Regenerate TypeScript types after any wrangler.jsonc change
npx wrangler types
```

> **Note:** `wrangler dev --remote` runs against the real Cloudflare resources, which is required for Workers AI / AI Gateway. If you use it, apply the two SQL files with `--remote` instead of `--local` too.

## Local Development

```bash
# With AI features (recommended): executes KV/D1/AI against your real account
npx wrangler dev --remote

# Local-only bindings (AI calls will fail / return empty)
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/bookmarks` | List all bookmarks |
| `GET` | `/bookmarks?tag=docs` | Filter by tag (comma-separated `tags`) |
| `POST` | `/bookmarks` | Create a bookmark (`url`, `title`, optional `tags`) |
| `GET` | `/bookmarks/:id` | Get one bookmark (KV cache first) |
| `DELETE` | `/bookmarks/:id` | Delete a bookmark |
| `GET` | `/` | API info (version, storage, endpoints) |

### Example

```bash
curl -X POST http://localhost:8787/bookmarks \
  -H "Content-Type: application/json" \
  -d '{"url":"https://developers.cloudflare.com/workers-ai/","title":"Workers AI Docs","tags":"docs,ai"}' | jq
```

```json
{
  "id": "6b7684f3",
  "url": "https://developers.cloudflare.com/workers-ai/",
  "title": "Workers AI Docs",
  "tags": "docs,ai",
  "summary": "Cloudflare Workers AI documentation provides resources for building AI-powered applications.",
  "created_at": "2026-08-08 18:14:04"
}
```

## Tests

```bash
npm test
```

## Deploy (Step 7, not yet done)

```bash
# Apply the base schema to the remote DB (most common cause of "no such table" post-deploy)
npx wrangler d1 execute bookmark-db --remote --file=./schema.sql

# Deploy
npx wrangler deploy

# Stream live logs / roll back if needed
npx wrangler tail
npx wrangler rollback
```

## Project Structure

```
├── src/index.ts            # Worker: routing + all handlers
├── schema.sql              # D1 schema (bookmarks table)
├── migration-summary.sql   # Adds summary column to bookmarks
├── wrangler.jsonc          # Worker config + bindings (KV, D1, AI)
├── test/index.spec.ts      # Vitest tests (cloudflare:test)
└── worker-configuration.d.ts
```

## Workshop Roadmap

1. ✅ Getting Started — scaffold, hello world
2. ✅ Add Routes and CRUD Endpoints
3. ✅ Persistent Storage with KV
4. ✅ D1 Database with KV Caching
5. ✅ AI-Powered Summaries
6. ✅ AI Gateway
7. ✅ Deploy to Production
