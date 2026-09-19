import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';

import { auth } from '@/auth';
import { getErrorMessage } from '@/lib/errors';
import { getUserDb } from '@/lib/userDb';

export const runtime = 'nodejs';

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

interface UserPinRow {
    id: string;
    osm_id: string;
    status: string;
    notes: string | null;
    tags: string | null;
    created_at: string;
    updated_at: string;
    custom_name: string | null;
    custom_lat: number | null;
    custom_lng: number | null;
    custom_address: string | null;
    custom_com_nom: string | null;
    custom_postal_code: string | null;
}

interface PlaceRow {
    osm_id: string;
    name: string | null;
    address: string | null;
    postal_code: string | null;
    com_nom: string | null;
    opening_hours: string | null;
    lng: number;
    lat: number;
}

function hydratePins(rows: UserPinRow[]) {
    const pdb = getPlacesDb();
    const stmt = pdb.prepare<[string], PlaceRow>(`SELECT osm_id, name, address, postal_code, com_nom, opening_hours, X as lng, Y as lat FROM places WHERE osm_id = ? LIMIT 1`);
    return rows.map((r) => {
        const isCustom = r.osm_id?.startsWith('custom_');
        const place = isCustom ? null : stmt.get(r.osm_id);
        const pos = place
            ? { lat: place.lat as number, lng: place.lng as number }
            : isCustom && r.custom_lat != null
            ? { lat: r.custom_lat as number, lng: r.custom_lng as number }
            : null;
        return {
            id: r.id,
            osm_id: r.osm_id,
            name: place?.name || r.custom_name || '(sans nom)',
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
            address: place?.address ?? r.custom_address ?? null,
            postal_code: place?.postal_code ?? r.custom_postal_code ?? null,
            com_nom: place?.com_nom ?? r.custom_com_nom ?? null,
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
        const rows = db
            .prepare<[string], UserPinRow>(`SELECT id, osm_id, status, notes, tags, created_at, updated_at, custom_name, custom_lat, custom_lng, custom_address, custom_com_nom, custom_postal_code FROM user_pins WHERE user_email = ?`)
            .all(session.user.email);
        const pins = hydratePins(rows);
        return new Response(JSON.stringify({ pins }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    } catch (e: unknown) {
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
        const { id, osm_id, status, notes = '', tags = [], createdAt, updatedAt, name: customName, lat: customLat, lng: customLng, address: customAddress = null, com_nom: customComNom = null, postal_code: customPostalCode = null } = body || {};
        if (!status) return new Response(JSON.stringify({ error: 'Missing status' }), { status: 400 });

        const db = getUserDb();
        const now = new Date().toISOString();
        const _id = id || `pin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

        let _osm_id: string;
        let _custom_name: string | null = null;
        let _custom_lat: number | null = null;
        let _custom_lng: number | null = null;
        let _custom_address: string | null = null;
        let _custom_com_nom: string | null = null;
        let _custom_postal_code: string | null = null;

        if (osm_id) {
            // OSM place pin — validate it exists
            const place = getPlacesDb().prepare(`SELECT osm_id FROM places WHERE osm_id = ?`).get(osm_id);
            if (!place)
                return new Response(JSON.stringify({ error: 'Unknown osm_id' }), { status: 400 });
            _osm_id = osm_id;
        } else if (customName && customLat != null && customLng != null) {
            // Custom (map-click) pin
            _osm_id = `custom_${_id}`;
            _custom_name = customName;
            _custom_lat = customLat;
            _custom_lng = customLng;
            _custom_address = customAddress;
            _custom_com_nom = customComNom;
            _custom_postal_code = customPostalCode;
        } else {
            return new Response(JSON.stringify({ error: 'Provide osm_id or name+lat+lng' }), { status: 400 });
        }

        const stmt = db.prepare(
            `INSERT INTO user_pins (id, osm_id, status, notes, tags, created_at, updated_at, user_email, custom_name, custom_lat, custom_lng, custom_address, custom_com_nom, custom_postal_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        try {
            stmt.run(_id, _osm_id, status, notes, JSON.stringify(tags), createdAt || now, updatedAt || now, session.user.email, _custom_name, _custom_lat, _custom_lng, _custom_address, _custom_com_nom, _custom_postal_code);
        } catch (err: unknown) {
            if (getErrorMessage(err).includes('UNIQUE')) {
                return new Response(
                    JSON.stringify({ error: 'duplicate', reason: 'osm_id already saved' }),
                    { status: 409 },
                );
            }
            throw err;
        }
        const row = db
            .prepare<[string], UserPinRow>(`SELECT id, osm_id, status, notes, tags, created_at, updated_at, custom_name, custom_lat, custom_lng, custom_address, custom_com_nom, custom_postal_code FROM user_pins WHERE id = ?`)
            .get(_id)!;
        const [pin] = hydratePins([row]);
        return new Response(JSON.stringify({ pin }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: unknown) {
        console.error('/api/user-pins POST error', e);
        return new Response(JSON.stringify({ error: 'Failed to create pin' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
