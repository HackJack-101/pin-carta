# Pin Carta — CLAUDE.md

See README.md for full setup instructions, API reference, and architecture overview.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- better-sqlite3 for synchronous SQLite access (server-side only)
- Leaflet for map rendering (client-only, dynamic import required)
- NextAuth v5 with Google provider

## Commands

```bash
npm run dev           # dev server (http://localhost:3000)
npm run build         # production build
npm run lint          # eslint
npm run import:sqlite # import data.csv → src/database/places.sqlite
```

## Key files

- `src/types.ts` — shared types (`RestaurantPin`, `SearchResult`, `PinStatus`, `LatLng`, `PinStatusLabel`)
- `src/auth.ts` — NextAuth config
- `src/lib/userDb.ts` — user DB access helpers
- `src/lib/userPins.ts` — client-side fetch wrappers for user pins
- `src/lib/storage.ts` — localStorage CRUD layer for client-side persistence
- `src/lib/id.ts` — unique ID generator for pins
- `src/app/page.tsx` — main page (map + search + pins)
- `src/app/api/search/route.ts` — read-only places search
- `src/app/api/user-pins/` — CRUD for user pins (auth-gated)
- `src/components/MapView.tsx` — Leaflet map (dynamic import)

## Conventions

- Absolute imports via `@/` prefix (tsconfig paths)
- Server routes export `export const runtime = "nodejs"` and named HTTP handlers
- New API routes go under `src/app/api/<route>/route.ts`
- DB paths: `process.env.DB_PATH ?? "./src/database/places.sqlite"` for places, `process.env.USER_DB_PATH ?? "./src/database/user.sqlite"` for users
- Three storage paths: places (read-only), user (read-write server), and client-side localStorage
- Auth guard: `const session = await auth()` then check `session?.user?.email`
- Tags stored as JSON strings in SQLite; serialize/deserialize on read/write
