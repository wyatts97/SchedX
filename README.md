<div align="center">
  <img src="./static/icons/icon-192.png" alt="" width="88" />

# SchedX

**Schedule posts and threads to X from your own server.**

</div>

SchedX is a self-hosted, single-user scheduler for X (Twitter) built on the official, pay-per-use X API. You write posts and threads, schedule them or drop them into a queue, and SchedX publishes them on time — with retries that never double-post and a running tally of what the API is costing you.

## What it does

- **Posts and threads** in one composer, with images (up to 4), GIFs or video, image descriptions (alt text), polls, reply controls, community posting and AI / paid-partnership disclosures.
- **Schedule, queue or post now.** The queue fills your own weekly posting times; reorder or shuffle it any time. Posts can repeat daily, weekly or monthly.
- **Calendar** with drag-to-reschedule, plus a list view with bulk move and delete.
- **Cost tracking.** Every post shows its estimated price before you publish (X charges far more for posts containing links), the dashboard tracks spend for the billing cycle, and a monthly budget cap pauses publishing instead of overspending.
- **Reliable publishing.** If a request to X times out, SchedX checks your timeline before retrying, so a post never goes out twice. Interrupted threads resume where they stopped. Posts missed while the server was off are published late within a catch-up window, or held for review.
- **Multiple X accounts**, cross-posting, drafts, a reusable media library and CSV import.
- **Installable app** (PWA) with push notifications for published, failed and paused posts.
- **Light, Dim and Lights out** themes.

## Requirements

- Node.js 22.17+ (24 recommended) for local development, or Docker for deployment
- An X developer account with pay-per-use credits — https://console.x.com

## Quick start (local, no X account needed)

```bash
npm install
cp .env.example .env
npm run gen:secrets   # paste the three printed lines into .env
npm run dev
```

Open http://127.0.0.1:5173 and create your SchedX login. With `X_API_MODE=mock` (the default in `.env.example`) SchedX uses a fake X client: you can connect pretend accounts and "publish" without anything leaving your machine or costing money. Put `[fail:transient]`, `[fail:ambiguous]`, `[fail:duplicate]`, `[fail:credits]` or `[fail:rate]` in a post to see how SchedX handles each kind of failure.

## Connect the real X API

1. In the [X Developer Console](https://console.x.com), open your app's **User authentication settings**:
   - App type: **Web App, Automated App or Bot**
   - App permissions: **Read and write**
   - Callback URI: `<APP_URL>/auth/x/callback` — e.g. `https://schedx.example.com/auth/x/callback`
2. Copy the **OAuth 2.0 Client ID and Client Secret** into `X_CLIENT_ID` / `X_CLIENT_SECRET`.
3. Set `X_API_MODE=live` and `APP_URL` to the address you open SchedX at, then restart.
4. In SchedX, go to **Accounts → Connect account** and approve access on X.

SchedX asks for `tweet.read tweet.write users.read media.write offline.access`. It only uses OAuth 2.0; the old OAuth 1.0a keys are not needed.

## Deploy with Docker behind Cloudflare Tunnel

The included `docker-compose.yml` binds SchedX to `127.0.0.1:3000` so it is only reachable through your tunnel.

```bash
cp .env.example .env      # set ENCRYPTION_KEY, APP_URL=https://schedx.example.com, X_* and VAPID_*
docker compose up -d --build
```

In the Cloudflare dashboard (Zero Trust → Networks → Tunnels → your tunnel → Public hostnames) add `schedx.example.com` → `http://localhost:3000`. Optionally put a Cloudflare Access policy in front of it for a second sign-in layer.

Data (database, uploads, nightly backups) lives in the `schedx-data` volume. Check health with `curl http://127.0.0.1:3000/api/health`.

## Costs

Prices come from X's pay-per-use table (October 2026) and can be edited under **Settings → Budget** when X changes them:

| Action                                   | Price       |
| ---------------------------------------- | ----------- |
| Post                                     | $0.015      |
| Post containing a link                   | $0.20       |
| Image description (alt text)             | $0.005      |
| Reading your own posts (delivery checks) | $0.001 each |

Your X Developer Console has the authoritative bill; set a spending limit there too.

## Configuration

| Variable                                                   | Default        | Purpose                                                         |
| ---------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `ENCRYPTION_KEY`                                           | — (required)   | Encrypts X tokens at rest. Changing it disconnects accounts.    |
| `APP_URL`                                                  | request origin | Public URL; used for the OAuth callback.                        |
| `X_API_MODE`                                               | `live`         | `mock` for the fake client.                                     |
| `X_CLIENT_ID` / `X_CLIENT_SECRET`                          | —              | OAuth 2.0 credentials from the X Developer Console.             |
| `DATA_DIR`                                                 | `./data`       | SQLite database, uploads and backups.                           |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | —              | Web push. Generate with `npm run gen:secrets`.                  |
| `MAX_UPLOAD_MB`                                            | `100`          | Largest upload. Cloudflare's free plan caps requests at 100 MB. |
| `SCHEDULER`                                                | `on`           | `off` runs the UI without publishing.                           |
| `LOG_LEVEL`                                                | `info`         | pino log level.                                                 |

Behind a proxy, adapter-node's `PROTOCOL_HEADER`, `HOST_HEADER` and `ADDRESS_HEADER` are set in `docker-compose.yml`.

## Development

```bash
npm run check        # types (svelte-check)
npm run lint         # prettier + eslint
npm test             # unit + engine integration tests (in-memory SQLite, mock X)
npm run test:e2e     # Playwright against a production build in mock mode
npm run db:generate  # after editing src/lib/server/db/schema.ts
```

Stack: SvelteKit 3, Svelte 5, Tailwind CSS 4, bits-ui, Drizzle ORM + better-sqlite3, twitter-api-v2, croner, web-push.

The pre-2.0 code (SvelteKit 2 monorepo with the Rettiwt analytics) is preserved under the `legacy-v1` git tag.

## License

[Elastic License 2.0](LICENSE)
