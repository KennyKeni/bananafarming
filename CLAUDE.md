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

# Frontend (after changes in src/ or index.html)
VITE_CONVEX_URL=https://convex.bananafarm.ing bun run build
bunx wrangler deploy

# One-off Convex function call against prod (e.g., reset)
bunx convex run --env-file .env.production.local counter:reset
```

## Architecture

### Server-authoritative game state

Convex owns the entire game state; the frontend only reads. Two tables (`convex/schema.ts`):
- `counter` — single row, the shared click count
- `upgrades` — one row per `(key, owned)` pair, indexed `by_key`

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
