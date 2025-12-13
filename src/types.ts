export type PinStatus = 'deja-essaye' | 'a-essayer';

export interface LatLng {
    lat: number;
    lng: number;
}

export interface RestaurantPin {
    id: string;
    osm_id: string; // link to immutable place in the read-only DB
    name: string; // hydrated from places
    status: PinStatus; // "déjà essayé" or "à essayer"
    notes?: string;
    tags: string[];
    position: LatLng; // hydrated from places (X/Y)
    address?: string | null; // hydrated from places
    postal_code?: string | null; // hydrated from places
    com_nom?: string | null; // hydrated from places
    opening_hours?: string | null; // hydrated from places
    createdAt: string; // ISO
    updatedAt: string; // ISO
}

export interface SearchResult {
    osm_id: string;
    type: string;
    name: string | null;
    brand: string | null;
    operator: string | null;
    address: string | null;
    postal_code: string | null;
    com_nom: string | null;
    opening_hours: string | null;
    lat: number;
    lng: number;
}

export const PinStatusLabel: Record<PinStatus, string> = {
    'deja-essaye': 'déjà essayé',
    'a-essayer': 'à essayer',
};
