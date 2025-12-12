import type { RestaurantPin } from '@/types';

export async function listUserPins(): Promise<RestaurantPin[]> {
    const res = await fetch('/api/user-pins', { cache: 'no-store' });
    if (res.status === 401) return [];
    if (!res.ok) throw new Error(`listUserPins HTTP ${res.status}`);
    const data = await res.json();
    return (data.pins || []) as RestaurantPin[];
}

export async function createUserPin(input: { osm_id: string; status: RestaurantPin['status']; notes?: string; tags?: string[] }): Promise<RestaurantPin> {
    const res = await fetch('/api/user-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (res.status === 409) {
        const err = new Error('duplicate');
        (err as any).code = 409;
        throw err;
    }
    if (!res.ok) throw new Error(`createUserPin HTTP ${res.status}`);
    const data = await res.json();
    return data.pin as RestaurantPin;
}

export async function updateUserPin(
    id: string,
    input: {
        status: RestaurantPin['status'];
        notes?: string;
        tags?: string[];
    },
): Promise<{ ok: true; updatedAt: string }> {
    const res = await fetch(`/api/user-pins/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`updateUserPin HTTP ${res.status}`);
    return res.json();
}

export async function deleteUserPin(id: string): Promise<void> {
    const res = await fetch(`/api/user-pins/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(`deleteUserPin HTTP ${res.status}`);
}
