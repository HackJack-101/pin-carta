# Pin Carta

Pin Carta is a Next.js 16 + React 19 app to explore places (restaurants, cafés, bars, …), search by name/brand/operator, and save personal pins with notes and tags. Data is stored in two local SQLite databases:

- places: read-only database imported from a CSV, queried by the app for search and metadata
- user: per-user pins and accounts, created locally on first run

This README is for both human developers and AI agents. It explains how to run the project and how to implement new features following the existing patterns.

---

## Quick start

Prerequisites:

- Node.js 20+ (LTS recommended)
- A Google OAuth client (for sign-in)

Steps:

1. Install dependencies

```bash
npm install
```

2. Prepare environment

Create a `.env.local` in the project root (see full list of vars below):

```ini
# Required at least for search API to work
# Path to the read-only places database. Example targets:
#  - ./src/database/places.sqlite (recommended project-local path)
#  - /absolute/path/to/places.sqlite
DB_PATH=./src/database/places.sqlite

# Optional: path to user data DB (created on first run if missing)
# Defaults to ./src/database/user.sqlite if not set
# USER_DB_PATH=./src/database/user.sqlite

# NextAuth (Google) — needed to sign in from the UI
NEXTAUTH_SECRET=replace-with-a-random-long-string
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
# NEXTAUTH_URL=http://localhost:3000
```

3. Create the places database

The CSV data source is [BANCO](https://www.data.gouv.fr/datasets/base-nationale-des-commerces-ouverte/) and is not included in the repo.

You have two options:

- If you already have a SQLite file: point `DB_PATH` at it
- Or import the provided CSV into a new DB:

```bash
# Imports data.csv -> ./src/database/places.sqlite by default
npm run import:sqlite

# Options (all optional):
#   --csv <path>        default: data.csv
#   --db <path>         default: ./src/database/places.sqlite
#   --table <name>      default: places
#   --delimiter <char>  default: ;
#   --no-truncate       do not clear existing rows before import

# Example: custom CSV and output path
npm run import:sqlite -- --csv ./data.csv --db ./src/database/places.sqlite
```

Notes about the import script:

- Only rows with `type` in {bar, cafe, fast_food, food_court, ice_cream, pub, restaurant} are imported
- Columns are inferred from the CSV header; special types are applied to `X`, `Y` (REAL NOT NULL) and `osm_id`, `type` (TEXT NOT NULL); others are TEXT
- Rows missing any NOT NULL column are skipped

4. Run the app in dev

```bash
npm run dev
```

Open http://localhost:3000 and sign in with Google. You can then search places and create/update/delete your personal pins.

Build and run for production:

```bash
npm run build
npm start
```

---

## Environment variables

- DB_PATH: absolute or relative path to the read-only places SQLite file. If missing, the server routes will throw a clear error asking you to set it
- USER_DB_PATH: path to the user SQLite file. If unset, `./src/database/user.sqlite` is created automatically on first use
- NEXTAUTH_SECRET: any random long string used by NextAuth JWT. Required in production; set locally as well
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: from your Google OAuth app
- NEXTAUTH_URL: usually `http://localhost:3000` in dev; set in production to your public URL

Google OAuth configuration:

- Authorized redirect URI in the Google Cloud Console must include: `http://localhost:3000/api/auth/callback/google`
- In the UI we call `signIn("google")` from next-auth; no extra config is needed client-side

---

## Project structure (high level)

- src/app: Next.js App Router
    - page.tsx: main UI (map + search + pins)
    - api/\*: server routes
        - api/search: read-only querying of the places DB
        - api/user-pins: CRUD for authenticated user pins
- src/components: React components (e.g., MapView, Panel, SearchBar)
- src/lib: client helpers (e.g., userPins fetch wrappers)
- src/types.ts: shared TypeScript types for pins and search results
- scripts/import_csv_to_sqlite.js: CSV → SQLite importer used to build the places DB

Notable dependencies:

- next 16 (App Router)
- next-auth 5 (Google provider)
- better-sqlite3 (fast, synchronous SQLite access on server)
- leaflet (map rendering on the client)

---

## How things work

- Places database (read-only):
    - Default location: `./src/database/places.sqlite` (can be overridden by `DB_PATH`)
    - `GET /api/search` opens this DB in read-only mode and runs a LIKE search on `name`, `brand`, and `operator`. Returned fields include `osm_id`, `type`, `name`, `brand`, `operator`, `address`, `com_insee`, `com_nom`, `opening_hours`, and coordinates as `lat`/`lng` (from `Y`/`X`)

- User database (read-write):
    - Default location: `./src/database/user.sqlite` (or `USER_DB_PATH`)
    - On first use the schema is created automatically with two tables: `users` and `user_pins`
    - `user_pins` uniqueness is scoped per user (`UNIQUE(user_email, osm_id)`) so the same place can be saved by multiple users independently
    - Legacy migrations are handled on startup if the `user_pins` table is missing the `user_email` column

- Auth (NextAuth):
    - Google provider is configured in `src/auth.ts`
    - Session strategy is JWT; the server routes read the session with `auth()` and gate user-pins endpoints

- Frontend:
    - Map is rendered via Leaflet in `MapView` with dynamic import to avoid SSR issues
    - `page.tsx` handles search, selection, pin CRUD, filtering, and geolocation-based conveniences
    - Types are centralized in `src/types.ts` (e.g., `RestaurantPin`, `PinStatus`)

---

## API reference (local dev)

All routes are under the Next.js App Router.

- GET /api/search?q=<text>&limit=<n>
    - Query params: `q` (required), `limit` (optional, 1–100, default 20)
    - Response: `{ results: Array<{ osm_id, type, name, brand, operator, address, com_insee, com_nom, opening_hours, lat, lng }> }`
    - Errors: 500 if DB is missing or query fails

- GET /api/user-pins
    - Auth required
    - Response: `{ pins: RestaurantPin[] }` with coordinates and address hydrated from the places DB

- POST /api/user-pins
    - Auth required
    - Body JSON: `{ osm_id: string, status: "deja-essaye" | "a-essayer", notes?: string, tags?: string[], createdAt?: ISO, updatedAt?: ISO }`
    - Responses: 201 with `{ pin }` or 409 `{ error: "duplicate" }` if the current user already saved the same `osm_id`

- PUT /api/user-pins/[id]
    - Auth required
    - Body JSON: `{ status: ..., notes?: string, tags?: string[] }`

- DELETE /api/user-pins/[id]
    - Auth required

---

## Developing new features

Follow the existing patterns and keep logic split across components, server routes, and small helpers.

- UI components
    - Place reusable UI in `src/components`
    - Client components should start with `"use client"`
    - Keep props typed; reuse shared types from `src/types.ts`

- Server routes (API)
    - Put new endpoints under `src/app/api/<route>/route.ts`
    - Export `export const runtime = "nodejs"` and the HTTP handlers (`GET`, `POST`, etc.)
    - Use `better-sqlite3` for SQLite access. For read-only datasets prefer `new Database(path, { readonly: true })`
    - Resolve DB paths like existing code:
        - Places: environment `DB_PATH` or `./src/database/places.sqlite`
        - User: environment `USER_DB_PATH` or `./src/database/user.sqlite` (ensure the directory exists)

- Data access and types
    - Keep SQL short and parameterized. Use prepared statements for repeated queries
    - Serialize arrays/objects to JSON strings in SQLite (see `tags` field)
    - Any API that returns pin-like data should return types compatible with `RestaurantPin`

- Auth
    - For routes that modify user data, call `const session = await auth()` and require `session.user.email`

- Conventions
    - Use absolute imports with `@/` (configured by Next.js tsconfig)
    - Keep functions small and pure when possible; prefer local helpers over large utilities
    - Add inline comments for non-obvious logic; follow existing code style

---

## Troubleshooting

- Error: "SQLite database not found. Set DB_PATH..."
    - Create a places DB with the import script or point `DB_PATH` to an existing file

- 401 Unauthorized on user-pins routes
    - Ensure Google sign-in is configured and you are logged in

- Google OAuth errors
    - Double-check `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and the authorized redirect URI

- Missing Leaflet marker icons
    - If default markers do not appear, copy the images into `public/`:
        - `public/marker-icon.png`, `public/marker-icon-2x.png`, `public/marker-shadow.png`
        - You can copy them from `node_modules/leaflet/dist/images/`

---

## Scripts

- Dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Start (production): `npm start`
- Import CSV → SQLite: `npm run import:sqlite` (see options above)

---

## License

Proprietary or TBD. Update this section according to your project's licensing.
