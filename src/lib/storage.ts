import { RestaurantPin } from '@/types';

const KEY = 'pin-carta:pins:v1';

export function loadPins(): RestaurantPin[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as RestaurantPin[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn('Failed to parse pins from localStorage', e);
        return [];
    }
}

export function savePins(pins: RestaurantPin[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(pins));
}

export function upsertPin(pin: RestaurantPin) {
    const pins = loadPins();
    const i = pins.findIndex((p) => p.id === pin.id);
    if (i >= 0) pins[i] = pin;
    else pins.push(pin);
    savePins(pins);
}

export function deletePin(id: string) {
    const pins = loadPins().filter((p) => p.id !== id);
    savePins(pins);
}
