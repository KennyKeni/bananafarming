# Banana Farm

A shared multiplayer cookie-clicker, but bananas. Every visitor clicks the same farm — the counter pools across everyone. Buy upgrades, rack up passive income, and climb the lifetime leaderboard.

Live at [bananafarm.ing](https://bananafarm.ing).

## What makes it different

- **One shared count.** The number you see is the same number everyone else sees. Clicks, ticks, and purchases are server-authoritative on Convex.
- **Per-player attribution.** Anyone can click the farm, but every click you make counts toward *your* lifetime banana total on the leaderboard.
- **Anonymous identity.** No accounts. A UUID in `localStorage` plus an auto-generated name (like `FestiveFlamingo29`) from a slot-machine reveal. Clearing storage loses your streak.
- **Live presence.** Active-player count and colored popups when other people click.

## Stack

- **Frontend:** React 19 + Vite + TypeScript, React Compiler, deployed to Cloudflare Workers via Wrangler.
- **Backend:** Self-hosted [Convex](https://www.convex.dev/self-hosted) (edge-runtime mutations, queries, crons).
- **Tests:** Vitest (jsdom for components, edge-runtime + `convex-test` for server logic). TDD throughout.
- **Package manager:** [Bun](https://bun.sh).

## Architecture

Three tables in `convex/schema.ts`:

- `counter` — one row, the shared click count
- `upgrades` — one row per upgrade key with `owned` count
- `players` — per-player stats (`clickBananas`, `clickCount`, `name`, `lastSeenAt`, `lastClickAt`)

Three mechanics, all server-computed:

- **Click** (`counter.increment`) — reads upgrade state, adds `totalClickPower()` to the shared counter, attributes bananas to the player, and rate-limits clicks per-player (40 ms min interval).
- **Tick** (`tick.tickOnce`, every 2 s via cron) — adds `totalCps()` to the shared counter.
- **Buy** (`upgrades.buy`) — atomic deduct + increment, cost grows exponentially per tier.

The upgrade config (`convex/upgrades/config.ts`) is imported by both server and client — adding a tier is a single append to that file.

## Getting started

Requires [Bun](https://bun.sh) and a [self-hosted Convex](https://www.convex.dev/self-hosted) instance (or Convex Cloud — adjust the URL accordingly).

```bash
bun install
```

Create `.env.local` with your Convex dev URL:

```
VITE_CONVEX_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=<your-admin-key>
```

Push the Convex schema and functions:

```bash
bunx convex deploy --env-file .env.local
```

Run the Vite dev server:

```bash
bun run dev
```

## Testing

```bash
bun run test:run                         # full suite
bun run test                             # watch mode
bun run test:run src/Cookie.test.tsx     # single file
bun run test:run -t "rate limit"         # single test by name
```

Server tests use `convex-test` with an in-memory DB in the `edge-runtime` environment. Component tests use Testing Library in `jsdom`.

## Deploying

Convex and the Cloudflare Worker deploy independently.

```bash
# Backend (after changes in convex/)
bunx convex deploy --env-file .env.production.local

# Frontend (after changes in src/ or index.html)
VITE_CONVEX_URL=https://<your-convex-domain> bun run build
bunx wrangler deploy
```
