# TTCGameLab

TTCGameLab is an AI creative studio for building interactive TikTok LIVE web experiences.

## Product architecture

A creator works in a persistent project workspace. Each project owns its conversation, assets, generated application state, host controls, and published runtime.

- `/` — studio home
- `/projects` — project library
- `/project/new` — new-project conversation
- `/project/[id]` — persistent project workspace and host controls
- `/published/[slug]` — published host-facing project runtime
- `/published/[slug]/overlay` — OBS/browser-source overlay runtime
- `/api/ai` — server-side Agnes AI gateway
- `/api/projects` — server-side project persistence when Neon is configured

## Local development

```bash
npm install
npm run dev
```

The app currently falls back to browser local storage so the workspace is usable before a database is provisioned.

## Production setup

1. Deploy the repository to Vercel.
2. Add a Neon Postgres resource through the Vercel Marketplace and provide `DATABASE_URL` to the project. New Vercel Postgres setups are now provided through Marketplace storage integrations such as Neon. (See Vercel's current Neon integration documentation.)
3. Run `db/schema.sql` once against the database.
4. Add `AGNES_API_KEY` as a Vercel server-side environment variable. The app defaults to `agnes-2.5-flash` through the official OpenAI-compatible Agnes endpoint.
5. Add the production domain and, for persistent project subdomains later, configure wildcard DNS such as `*.ttcgamelab.space` to the Vercel deployment.

## Security

Never commit API keys or `.env` files. Agnes credentials are only read on the server.
