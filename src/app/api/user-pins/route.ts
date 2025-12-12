import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getUserDb } from '@/lib/userDb';

export const runtime = 'nodejs';

function ensureDir(p: string) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolvePlacesDb(): string {
    const envPath = process.env.DB_PATH?.trim();
    if (envPath && fs.existsSync(envPath)) return envPath;
    const candidate = path.join(process.cwd(), 'src', 'database', 'places.sqlite');
    if (fs.existsSync(candidate)) return candidate;
    throw new Error('Places SQLite database not found. Set DB_PATH or provide src/database/places.sqlite');
}

let placesDb: Database.Database | null = null;

function getPlacesDb() {
    if (!placesDb) {
        const p = resolvePlacesDb();
        placesDb = new Database(p, { readonly: true });
    }
    return placesDb!;
}

function hydratePins(rows: any[]) {
    const pdb = getPlacesDb();
    const stmt = pdb.prepare(`SELECT osm_id, name, address, com_insee, com_nom, opening_hours, X as lng, Y as lat FROM places WHERE osm_id = ? LIMIT 1`);
    return rows.map((r) => {
        const place = stmt.get(r.osm_id);
        const pos = place ? { lat: place.lat as number, lng: place.lng as number } : null;
        return {
            id: r.id,
            osm_id: r.osm_id,
            name: place?.name || '(sans nom)',
            status: r.status,
            notes: r.notes || '',
            tags: (() => {
                try {
                    return JSON.parse(r.tags || '[]');
                } catch {
                    return [];
                }
            })(),
            position: pos || { lat: 0, lng: 0 },
            address: place?.address ?? null,
            com_insee: place?.com_insee ?? null,
            com_nom: place?.com_nom ?? null,
            opening_hours: place?.opening_hours ?? null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    });
}

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

        const db = getUserDb();
        const rows = db.prepare(`SELECT id, osm_id, status, notes, tags, created_at, updated_at FROM user_pins WHERE user_email = ?`).all(session.user.email);
        const pins = hydratePins(rows);
        return new Response(JSON.stringify({ pins }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    } catch (e: any) {
        console.error('/api/user-pins GET error', e);
        return new Response(JSON.stringify({ error: 'Failed to load user pins' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });

        const body = await req.json();
        const { id, osm_id, status, notes = '', tags = [], createdAt, updatedAt } = body || {};
        if (!osm_id || !status) return new Response(JSON.stringify({ error: 'Missing osm_id or status' }), { status: 400 });

        // Validate place exists
        const place = getPlacesDb().prepare(`SELECT osm_id FROM places WHERE osm_id = ?`).get(osm_id);
        if (!place)
            return new Response(JSON.stringify({ error: 'Unknown osm_id' }), {
                status: 400,
            });

        const db = getUserDb();
        const now = new Date().toISOString();
        const _id = id || `pin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const stmt = db.prepare(`INSERT INTO user_pins (id, osm_id, status, notes, tags, created_at, updated_at, user_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        try {
            stmt.run(_id, osm_id, status, notes, JSON.stringify(tags), createdAt || now, updatedAt || now, session.user.email);
        } catch (err: any) {
            if (String(err?.message || err).includes('UNIQUE')) {
                return new Response(
                    JSON.stringify({
                        error: 'duplicate',
                        reason: 'osm_id already saved',
                    }),
                    { status: 409 },
                );
            }
            throw err;
        }
        const row = db.prepare(`SELECT id, osm_id, status, notes, tags, created_at, updated_at FROM user_pins WHERE id = ?`).get(_id);
        const [pin] = hydratePins([row]);
        return new Response(JSON.stringify({ pin }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('/api/user-pins POST error', e);
        return new Response(JSON.stringify({ error: 'Failed to create pin' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
