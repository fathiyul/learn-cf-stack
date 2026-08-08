# Cloudflare Workers Getting Started

A learning project built while following Cloudflare Developers' YouTube tutorial:

> [Learn Cloudflare Workers 101 - Full Course for Beginners](https://www.youtube.com/watch?v=H7Qe96fqg1M)  
> by [Cloudflare Developers](https://www.youtube.com/@CloudflareDevelopers)

This project is my hands-on introduction to Cloudflare Workers. The current Worker uses [Hono](https://hono.dev/) and a [Workers AI](https://developers.cloudflare.com/workers-ai/) binding to return an AI-generated response.

## Prerequisites

- Node.js and npm
- A Cloudflare account

## Getting started

Install the dependencies:

```sh
npm install
```

Start the local development server:

```sh
npm run dev
```

Open the local URL printed by Wrangler. You can provide a prompt with the `query` parameter:

```text
http://localhost:8787/?query=Explain%20Cloudflare%20Workers
```

If `query` is omitted, the Worker uses a default prompt.

## Available commands

```sh
npm run dev       # Run the Worker locally
npm test          # Run the Vitest test suite
npm run cf-typegen # Generate types from the Wrangler configuration
npm run deploy    # Deploy the Worker to Cloudflare
```

Before deploying, authenticate Wrangler with your Cloudflare account if needed:

```sh
npx wrangler login
```

## Project structure

```text
src/index.ts             Worker application and routes
test/index.spec.ts       Worker tests
wrangler.jsonc           Cloudflare Worker configuration and bindings
worker-configuration.d.ts Generated Cloudflare binding types
```

## Acknowledgements

This repository was created for personal learning while following **Learn Cloudflare Workers 101 - Full Course for Beginners** by **Cloudflare Developers**. All credit for the course material belongs to Cloudflare Developers.
