import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getUserDb } from '@/lib/userDb';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });
        const { id } = await params;
        const body = await req.json();
        const { status, notes = '', tags = [] } = body || {};
        if (!status)
            return new Response(JSON.stringify({ error: 'Missing status' }), {
                status: 400,
            });

        const db = getUserDb();
        const now = new Date().toISOString();
        const stmt = db.prepare(`UPDATE user_pins SET status = ?, notes = ?, tags = ?, updated_at = ? WHERE id = ? AND user_email = ?`);
        const info = stmt.run(status, notes, JSON.stringify(tags), now, id, session.user.email);
        if (info.changes === 0)
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
            });
        return new Response(JSON.stringify({ ok: true, updatedAt: now }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('/api/user-pins/[id] PUT error', e);
        return new Response(JSON.stringify({ error: 'Failed to update pin' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });
        const { id } = await params;
        const db = getUserDb();
        const info = db.prepare(`DELETE FROM user_pins WHERE id = ? AND user_email = ?`).run(id, session.user.email);
        if (info.changes === 0)
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
            });
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('/api/user-pins/[id] DELETE error', e);
        return new Response(JSON.stringify({ error: 'Failed to delete pin' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
