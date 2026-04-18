# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Shared multiplayer cookie-clicker (banana-themed) deployed at bananafarm.ing. React 19 + Vite frontend on Cloudflare Workers; self-hosted Convex backend at convex.bananafarm.ing. Package manager is **bun**.

## Commands

```bash
bun run dev               # Vite dev server (ask user to start, never auto-start)
bun run build             # tsc -b && vite build — requires VITE_CONVEX_URL
bun run lint              # eslint
bun run test              # vitest watch
bun run test:run          # single run — use this for CI-style checks
bun run test:run src/Cookie.test.tsx   # single file
bun run test:run -t "name"             # single test by name
```

### Deploy

Convex and the Worker deploy independently — only run the one whose code changed.

```bash
# Convex (after changes in convex/)
bunx convex deploy --env-file .env.production.local

# Local self-hosted Convex (dev server at 127.0.0.1:3210) — push local schema/function changes
bunx convex deploy --env-file .env.local

# Frontend (after changes in src/ or index.html)
VITE_CONVEX_URL=https://convex.bananafarm.ing bun run build
bunx wrangler deploy

# One-off Convex function call against prod (e.g., reset)
bunx convex run --env-file .env.production.local counter:reset
```

## Architecture

### Server-authoritative game state

Convex owns the entire game state; the frontend only reads. Three tables (`convex/schema.ts`):
- `counter` — single row, the shared click count
- `upgrades` — one row per `(key, owned)` pair, indexed `by_key`
- `players` — lifetime per-player stats (name, `clickBananas`, `clickCount`, `nameClaimedAt`, `lastSeenAt`); indexed `by_playerId`, `by_name`, `by_clickBananas`, `by_lastSeenAt`. Convex indexes aren't unique — `players.claim` and the upsert path in `counter.increment` enforce uniqueness via read-before-insert.

Three mechanics, all computed server-side:
- **Click** (`counter.increment`): reads all `upgrades`, computes `totalClickPower(ownedByKey)`, adds that to `counter.count`. The frontend's `handleClick` only invokes the mutation — it never decides how much to add.
- **Tick** (`tick.tickOnce` + `crons.ts`): every 2s, adds `totalCps(ownedByKey)` to `counter.count`. Internal mutation, not callable from client.
- **Buy** (`upgrades.buy`): reads `counter` + the target upgrade row, computes `costAt(baseCost, owned, costMultiplier)`, atomically deducts cost and increments `owned`. Throws `ConvexError` with `code: "insufficient_funds" | "unknown_upgrade"`.

### Upgrades config is the single source of truth

`convex/upgrades/config.ts` exports `UPGRADES` (readonly tuple) and helpers `costAt`, `totalCps`, `totalClickPower`, `getUpgrade`. Both frontend and backend import from this file — `convex/upgrades/` is a subdirectory specifically so the config is sharable without being a Convex function module.

Adding a tier: append one entry to `UPGRADES`. Cost/cps pattern for passive generators is ×100 `baseCost` / ×10 `cps` per tier. The `click` tier is special — `cps: 0`, `clickPower: 1`, `costMultiplier: 5` (everything else uses 2).

### Frontend popup/pulse logic (`src/Cookie.tsx`)

Because clicks are server-authoritative, every connected client sees the same `count` delta when anyone clicks. The component distinguishes four delta cases in one `useEffect` on `count`:
- `delta === cps` → passive tick: spawn `+cps` popup and pulse the farm button
- `delta === clickPower` AND `pendingOwnClicksRef > 0` → our own click confirming back: suppress (we already showed the local popup optimistically in `handleClick`)
- `delta === clickPower` AND no pending own clicks → another user clicked: spawn popup
- anything else (including batched catch-up after tab was backgrounded) → no popup

`pendingOwnClicksRef` is incremented on click, decremented when a matching delta arrives. This dedup is why the test suite asserts specific `+N` popup counts across rerenders.

### Identity + leaderboard

No auth. `src/usePlayerId.ts` generates a `crypto.randomUUID()` on first load and persists it in `localStorage` under `banana-farm:playerId` (with a try/catch + in-memory fallback for private-browsing modes that throw on `setItem`). This ID is passed to every server mutation that mutates player state (`increment`, `ensure`, `heartbeat`, `claim`).

Name picking is a two-phase flow:
1. On first load, `api.players.me` returns `null` or a row with `nameClaimedAt == null`. App mounts `<SlotMachine>` (overlay) which lets the user spin three reels (adjective + animal + 2-digit suffix) pulling from `convex/players/names.ts` pools. Clicking "Lock in" calls `api.players.claim`, which re-validates the name server-side via `validateName` (rejects anything outside the pools) — so the server can't be tricked into storing arbitrary names.
2. `players.claim` also resolves collisions by appending 2 hex chars derived from a hash of `playerId` — deterministic per-player so retries converge.

Active-player count is `api.players.activeCount`: rows with `lastSeenAt >= now - 30s`. Client sends `heartbeat` every 15s from `App.tsx`.

Leaderboard ranking (`api.players.topLeaderboard`) is top-10 by `clickBananas` + a "you" row. For players outside the top 10, rank is computed with an O(N) scan guarded by a 5000-row cap — above that, `you.rank` is `null` (panel falls back to "not ranked").

### Falling bananas (`src/FallingBananas.tsx`)

Background particles scaled to cps. Two perf caps: **5 spawns/sec max** (period = `clamp(200ms, 2000ms/√cps, 2000ms)`) and **25 concurrent on-screen max**. Removal is driven by `onAnimationEnd`, not `setTimeout` — this was a bugfix: background tab throttling caused timer-based cleanup to stall and pin the state at MAX_BANANAS forever.

## Testing (Vitest, dual-environment)

`vitest.config.ts` splits tests into two projects by path:
- `convex/**/*.test.ts` → `edge-runtime` env, uses `convex-test` with `convexTest(schema)` for in-memory DB
- `src/**/*.test.{ts,tsx}` → `jsdom` + `@testing-library/react`, setup in `src/test-setup.ts`

Frontend tests mock `convex/react`'s `useQuery`/`useMutation` manually (see `src/Cookie.test.tsx` top) — we do not spin up a Convex test client for React tests. The mock shape matches what `api.counter.get` / `api.upgrades.list` return.

### TDD is enforced

This project follows strict RED→GREEN TDD (see `test-driven-development` skill). Never write production code without a failing test first. When adding an upgrade tier or changing cost/cps math, update `convex/upgrades/config.test.ts` (the keys-in-order assertion) and `convex/upgrades.test.ts` (the per-tier cost expectations) as part of the RED step.

## React Compiler

Enabled via `@rolldown/plugin-babel` with `reactCompilerPreset()` in `vite.config.ts`. Do not hand-add `useMemo`/`useCallback` for performance unless profiling shows the compiler missed something — its memoization markers are present in built bundles.
