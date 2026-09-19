import type { RestaurantPin } from '@/types';
import { throwApiError } from '@/lib/apiError';

export async function listUserPins(): Promise<RestaurantPin[]> {
    const res = await fetch('/api/user-pins', { cache: 'no-store' });
    if (res.status === 401) return [];
    if (!res.ok) await throwApiError(res, `listUserPins HTTP ${res.status}`);
    const data = await res.json();
    return (data.pins || []) as RestaurantPin[];
}

export async function createCustomPin(input: { name: string; lat: number; lng: number; address?: string | null; com_nom?: string | null; postal_code?: string | null; status: RestaurantPin['status']; notes?: string; tags?: string[] }): Promise<RestaurantPin> {
    const res = await fetch('/api/user-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) await throwApiError(res, `createCustomPin HTTP ${res.status}`);
    const data = await res.json();
    return data.pin as RestaurantPin;
}

export async function createUserPin(input: { osm_id: string; status: RestaurantPin['status']; notes?: string; tags?: string[] }): Promise<RestaurantPin> {
    const res = await fetch('/api/user-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) await throwApiError(res, `createUserPin HTTP ${res.status}`);
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
    if (!res.ok) await throwApiError(res, `updateUserPin HTTP ${res.status}`);
    return res.json();
}

export async function deleteUserPin(id: string): Promise<void> {
    const res = await fetch(`/api/user-pins/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!res.ok) await throwApiError(res, `deleteUserPin HTTP ${res.status}`);
}
