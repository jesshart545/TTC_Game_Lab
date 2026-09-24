# TTCGameLab

TTCGameLab is an AI creative studio for building interactive TikTok LIVE web experiences.

## Product architecture

A creator works in a persistent project workspace. Each project owns its conversation, assets, generated application state, host controls, and published runtime.

- `/` — studio home
- `/projects` — project library
- `/project/new` — new-project conversation
- `/project/[id]` — persistent project workspace and host controls
- `<slug>.<project-domain>/` — published host dashboard (with wildcard domain configured)
- `<slug>.<project-domain>/overlay` — TikTok Live Studio/browser-source audience view
- `/published/[slug]` and `/published/[slug]/overlay` — same runtimes on the studio domain without wildcard routing
- `/api/ai` — server-side Agnes AI gateway
- `/api/projects` — server-side project persistence when Neon is configured
- `/api/live/[slug]` — server-backed published button events, polled by the overlay

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
5. Configure a wildcard project domain on the deployment, such as `*.ttcgamelab.com`, and point its DNS at Vercel. Set both `PROJECT_BASE_DOMAIN` and `NEXT_PUBLIC_PROJECT_BASE_DOMAIN` to `ttcgamelab.com` (without `*.`). The studio domain remains the generator; each published project slug maps to its own host with dashboard `/` and overlay `/overlay`. Until the wildcard domain and variables are configured, published projects use `/published/[slug]` and `/published/[slug]/overlay` on the studio domain.

Publish saves an approved snapshot and provides a dashboard access key. Updates keep the existing key so a phone or tablet dashboard stays connected. The builder's **Copy Dashboard Link for Phone** action copies a private link that the creator can send to another device. The dashboard keeps the key on that device and removes it from the address bar. The overlay URL does not contain it. Events are stored in Neon and the overlay checks for new events once per second.

The current project create/edit/publish APIs still need creator authentication before public launch; the host key alone does not protect those APIs.

## Security

Never commit API keys or `.env` files. Agnes credentials are only read on the server.
