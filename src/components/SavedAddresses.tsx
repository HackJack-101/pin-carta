'use client';

import { PinStatus, PinStatusLabel, RestaurantPin } from '@/types';

interface SavedAddressesProps {
    pins: RestaurantPin[];
    filter: 'all' | PinStatus;
    setFilter: (f: 'all' | PinStatus) => void;
    onSelectPin: (pin: RestaurantPin) => void;
    sortCenter: { lat: number; lng: number };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}

export default function SavedAddresses({ pins, filter, setFilter, onSelectPin, sortCenter }: SavedAddressesProps) {
    const filtered = filter === 'all' ? pins : pins.filter((p) => p.status === filter);
    const sorted = [...filtered].sort((a, b) => {
        const da = haversineKm(sortCenter, a.position);
        const db = haversineKm(sortCenter, b.position);
        return da - db;
    });

    return (
        <div className="flex h-full flex-col bg-zinc-50/80 pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
            {/* Filter bar */}
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
                <div className="flex gap-2">
                    {(['all', 'a-essayer', 'deja-essaye'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
                                filter === f
                                    ? 'bg-zinc-900 text-white shadow-sm'
                                    : 'bg-white text-zinc-500 shadow-sm shadow-black/5 hover:bg-zinc-100 hover:text-zinc-700'
                            }`}
                        >
                            {f === 'all' ? 'Tous' : PinStatusLabel[f]}
                        </button>
                    ))}
                </div>
                <span className="ml-auto text-xs font-medium text-zinc-500">
                    {sorted.length} résultat{sorted.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:px-6">
                {sorted.length === 0 ? (
                    <div className="mx-auto flex h-48 max-w-3xl items-center justify-center">
                        <div className="text-center">
                            <div className="mb-2 text-3xl">📍</div>
                            <p className="text-sm text-zinc-500">Aucune adresse enregistrée</p>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {sorted.map((pin) => {
                            const dist = haversineKm(sortCenter, pin.position);
                            return (
                                <button
                                    key={pin.id}
                                    onClick={() => onSelectPin(pin)}
                                    className="group flex w-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm shadow-black/5 transition-all duration-200 hover:border-zinc-300 hover:shadow-md active:scale-[0.98]"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-zinc-900 group-hover:text-zinc-700">
                                            {pin.name}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                                                pin.status === 'a-essayer'
                                                    ? 'bg-amber-50 text-amber-600'
                                                    : 'bg-emerald-50 text-emerald-600'
                                            }`}
                                        >
                                            {PinStatusLabel[pin.status]}
                                        </span>
                                    </div>
                                    {pin.address && (
                                        <p className="mt-1 truncate text-xs text-zinc-500">{pin.address}</p>
                                    )}
                                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                                        {(pin.tags ?? []).length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {(pin.tags ?? []).slice(0, 3).map((t) => (
                                                    <span
                                                        key={t}
                                                        className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                                {(pin.tags ?? []).length > 3 && (
                                                    <span className="text-[10px] text-zinc-500">+{(pin.tags ?? []).length - 3}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <div />
                                        )}
                                        <span className="shrink-0 text-[11px] font-medium text-zinc-500">
                                            {formatDistance(dist)}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
