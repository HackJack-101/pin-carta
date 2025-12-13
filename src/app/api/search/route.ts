import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

function resolveDbPath(): string {
    // Priority: ENV -> src/database/places.sqlite
    const envPath = process.env.DB_PATH?.trim();
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidate = path.join(process.cwd(), 'src', 'database', 'places.sqlite');
    if (fs.existsSync(candidate)) return candidate;

    // Neither DB_PATH nor the default candidate exists: fail explicitly
    throw new Error('SQLite database not found. Set DB_PATH to an existing file or place the database at src/database/places.sqlite');
}

let db: Database.Database | null = null;
function getDb() {
    if (!db) {
        const dbPath = resolveDbPath();
        db = new Database(dbPath, { readonly: true });
    }
    return db!;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limitParam = Number(searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 20;

    if (!q) {
        return new Response(JSON.stringify({ results: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const database = getDb();
        const like = `%${q.replace(/[%_]/g, '')}%`;

        // Columns: name, address, postal_code, com_nom, osm_id, type, brand, operator
        const sql = `
      SELECT osm_id, type, name, brand, operator, address, postal_code, com_nom, opening_hours, X as lng, Y as lat
      FROM places
      WHERE (
        name LIKE @like OR
        brand LIKE @like OR
        operator LIKE @like
      )
      LIMIT @limit
    `;
        const stmt = database.prepare(sql);
        const rows = stmt.all({ like, limit });

        return new Response(JSON.stringify({ results: rows }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        console.error('/api/search error', err);
        return new Response(
            JSON.stringify({
                error: 'Search failed',
                details: String(err?.message || err),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}
